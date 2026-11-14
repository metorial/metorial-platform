import { beforeEach, describe, expect, it, vi } from 'vitest';

let processors: Record<string, (data: any) => Promise<void>> = {};

let genesis = { machine: { get: vi.fn() } };

let db = {
  sandboxMachineImage: { findUnique: vi.fn() },
  sandboxMachine: { findUnique: vi.fn() },
  sandboxDisk: { findUnique: vi.fn() }
};

let search = {
  deleteSandboxDiskDocument: vi.fn(),
  indexSandboxDiskDocument: vi.fn(),
  deleteSandboxImageDocument: vi.fn(),
  deleteSandboxMachineDocument: vi.fn(),
  indexSandboxImageDocument: vi.fn(),
  indexSandboxMachineDocument: vi.fn()
};

vi.mock('../src/lib/regions', () => ({ getRegionClient: vi.fn(() => genesis) }));
vi.mock('@metorial/db', () => ({ db }));
vi.mock('@metorial/module-search', () => ({
  ...search,
  sandboxGlobalSearchTenantId: 'sandbox_global'
}));
vi.mock('@metorial/queue', () => ({
  combineQueueProcessors: vi.fn((list: any[]) => list),
  createQueue: vi.fn((opts: { name: string }) => ({
    add: vi.fn(),
    process: (fn: (data: any) => Promise<void>) => {
      processors[opts.name] = fn;
      return fn;
    }
  }))
}));

await import('../src/queues/search');

let tenant = { id: 'sbt_1', region: { id: 'aws:us-east-1' } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sandbox image search indexing', () => {
  let run = (data: { imageOid: string }) => processors['sbx/search/image']!(data);

  it('indexes an instance image under its instance', async () => {
    db.sandboxMachineImage.findUnique.mockResolvedValue({
      id: 'sbi_1',
      status: 'active',
      name: 'Node',
      identifier: null,
      instance: { id: 'ins_1' }
    });

    await run({ imageOid: '5' });

    expect(search.indexSandboxImageDocument).toHaveBeenCalledWith({
      id: 'sbi_1',
      tenantId: 'ins_1',
      name: 'Node',
      identifier: null
    });
  });

  it('indexes a global image under the shared global tenant', async () => {
    db.sandboxMachineImage.findUnique.mockResolvedValue({
      id: 'sbi_2',
      status: 'active',
      name: 'Ubuntu',
      identifier: 'ubuntu',
      instance: null
    });

    await run({ imageOid: '6' });

    expect(search.indexSandboxImageDocument).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sbi_2', tenantId: 'sandbox_global' })
    );
  });

  it('removes a deleted image from the index', async () => {
    db.sandboxMachineImage.findUnique.mockResolvedValue({
      id: 'sbi_1',
      status: 'deleted',
      instance: { id: 'ins_1' }
    });

    await run({ imageOid: '5' });

    expect(search.deleteSandboxImageDocument).toHaveBeenCalledWith({ id: 'sbi_1' });
    expect(search.indexSandboxImageDocument).not.toHaveBeenCalled();
  });
});

describe('sandbox machine search indexing', () => {
  let run = (data: { machineOid: string }) => processors['sbx/search/machine']!(data);

  it('indexes the name and slug the region reports', async () => {
    db.sandboxMachine.findUnique.mockResolvedValue({
      id: 'sbm_1',
      status: 'active',
      instance: { id: 'ins_1' },
      tenant
    });
    genesis.machine.get.mockResolvedValue({ name: 'web', slug: 'web-1a2b' });

    await run({ machineOid: '9' });

    expect(genesis.machine.get).toHaveBeenCalledWith({
      tenantId: 'sbt_1',
      machineId: 'sbm_1'
    });
    expect(search.indexSandboxMachineDocument).toHaveBeenCalledWith({
      id: 'sbm_1',
      instanceId: 'ins_1',
      name: 'web',
      slug: 'web-1a2b'
    });
  });

  it('removes a terminated machine without asking the region', async () => {
    db.sandboxMachine.findUnique.mockResolvedValue({
      id: 'sbm_1',
      status: 'deleted',
      instance: { id: 'ins_1' },
      tenant
    });

    await run({ machineOid: '9' });

    expect(search.deleteSandboxMachineDocument).toHaveBeenCalledWith({ id: 'sbm_1' });
    expect(genesis.machine.get).not.toHaveBeenCalled();
  });
});

describe('sandbox disk search indexing', () => {
  let run = () => processors['sbx/search/disk']!({ diskOid: '20' });

  it('indexes the local disk name under its instance', async () => {
    db.sandboxDisk.findUnique.mockResolvedValue({
      id: 'sbd_1',
      type: 'standard',
      status: 'active',
      name: 'Data',
      instance: { id: 'ins_1' }
    });

    await run();

    expect(search.indexSandboxDiskDocument).toHaveBeenCalledWith({
      id: 'sbd_1',
      instanceId: 'ins_1',
      name: 'Data'
    });
  });

  it('removes a deleted standard disk', async () => {
    db.sandboxDisk.findUnique.mockResolvedValue({
      id: 'sbd_1',
      type: 'standard',
      status: 'deleted'
    });

    await run();

    expect(search.deleteSandboxDiskDocument).toHaveBeenCalledWith({ id: 'sbd_1' });
    expect(search.indexSandboxDiskDocument).not.toHaveBeenCalled();
  });

  it.each(['active', 'deleted'])('never indexes a %s root filesystem disk', async status => {
    db.sandboxDisk.findUnique.mockResolvedValue({ id: 'sbd_root', type: 'root_fs', status });

    await run();

    expect(search.indexSandboxDiskDocument).not.toHaveBeenCalled();
    expect(search.deleteSandboxDiskDocument).not.toHaveBeenCalled();
  });
});
