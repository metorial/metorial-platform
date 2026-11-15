import { beforeEach, describe, expect, it, vi } from 'vitest';

let genesis = { machineImage: { build: { create: vi.fn() } } };

let processors: Record<string, (data: any, job: any) => Promise<void>> = {};

let db = {
  sandboxMachineImageBuild: { findFirst: vi.fn(), updateMany: vi.fn() }
};

let endImageBuild = vi.fn();
let downloadFileContent = vi.fn();
let fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

vi.mock('../src/lib/regions', () => ({
  getRegionClient: vi.fn(() => genesis),
  getRegionUrl: vi.fn(() => 'https://genesis.internal/rpc')
}));
vi.mock('../src/lib/imageBuildEnd', () => ({
  endImageBuild,
  terminalBuildStatuses: ['succeeded', 'failed', 'cancelled', 'timed_out']
}));
vi.mock('@metorial/module-file', () => ({ fileService: { downloadFileContent } }));
vi.mock('@metorial/queue', () => ({
  combineQueueProcessors: vi.fn((list: any[]) => list),
  createQueue: vi.fn((opts: { name: string }) => ({
    add: vi.fn(),
    process: (fn: any) => {
      processors[opts.name] = fn;
      return fn;
    }
  }))
}));
vi.mock('@metorial/db', () => ({ db }));

await import('../src/queues/imageBuildUpload');

let run = (attemptsMade = 0) =>
  processors['sbx/image/build/upload']!({ buildOid: '50' }, { attemptsMade });

let build = (overrides: any = {}) => ({
  oid: 50n,
  id: 'sbb_1',
  sourceFile: { oid: 90n, status: 'active', storeId: 'store_1' },
  regions: [
    {
      kind: 'builder',
      genesisImageId: 'gimg',
      region: { id: 'aws:us-east-1' },
      tenant: { id: 'tenant_iad1' }
    }
  ],
  ...overrides
});

let upload = {
  url: null,
  path: '/genesis/internal/uploads/machine-image-builds/gbuild/context',
  method: 'PUT',
  headers: { authorization: 'Bearer t' }
};

describe('image build upload job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.sandboxMachineImageBuild.findFirst.mockResolvedValue(build());
    genesis.machineImage.build.create.mockResolvedValue({ upload });
    downloadFileContent.mockResolvedValue(Buffer.from('context'));
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
  });

  it('uploads the file to a fresh upload url and records it', async () => {
    await run();

    expect(genesis.machineImage.build.create).toHaveBeenCalledWith({
      tenantId: 'tenant_iad1',
      imageId: 'gimg',
      idempotencyKey: 'sbb_1'
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://genesis.internal/genesis/internal/uploads/machine-image-builds/gbuild/context',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ authorization: 'Bearer t', 'content-length': '7' })
      })
    );
    expect(db.sandboxMachineImageBuild.updateMany).toHaveBeenCalledWith({
      where: { oid: 50n, contextUploadedAt: null },
      data: { contextUploadedAt: expect.any(Date) }
    });
    expect(endImageBuild).not.toHaveBeenCalled();
  });

  it('skips the upload when genesis already has the context', async () => {
    genesis.machineImage.build.create.mockResolvedValue({ upload: null });

    await run();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.sandboxMachineImageBuild.updateMany).toHaveBeenCalled();
  });

  it('does nothing for a build that ended or was already uploaded', async () => {
    db.sandboxMachineImageBuild.findFirst.mockResolvedValue(null);

    await run();

    expect(genesis.machineImage.build.create).not.toHaveBeenCalled();
  });

  it('fails the build when the file is gone', async () => {
    db.sandboxMachineImageBuild.findFirst.mockResolvedValue(build({ sourceFile: null }));

    await run();

    expect(endImageBuild).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        failure: expect.objectContaining({ code: 'context_unavailable' })
      })
    );
  });

  it('fails the build without retrying on a client error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400 });

    await run();

    expect(endImageBuild).toHaveBeenCalledWith(
      expect.objectContaining({ failure: expect.objectContaining({ code: 'upload_failed' }) })
    );
  });

  it('retries on a server error until the last attempt', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });

    await expect(run(0)).rejects.toThrow('status 503');
    expect(endImageBuild).not.toHaveBeenCalled();

    await run(4);

    expect(endImageBuild).toHaveBeenCalledWith(
      expect.objectContaining({ failure: expect.objectContaining({ code: 'upload_failed' }) })
    );
  });
});
