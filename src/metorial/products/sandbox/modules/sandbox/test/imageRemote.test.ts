import { beforeEach, describe, expect, it, vi } from 'vitest';

let makeClient = () => ({ machineImage: { update: vi.fn(), delete: vi.fn() } });

let clients: Record<string, ReturnType<typeof makeClient>> = {
  'aws:eu-west-1': makeClient(),
  'aws:us-east-1': makeClient()
};

let queues: Record<string, { add: any; addManyWithOps: any }> = {};
let processors: Record<string, (data: any) => Promise<void>> = {};

let db = {
  sandboxMachineImage: { findFirst: vi.fn() },
  sandboxMachineImageRegion: { findMany: vi.fn() },
  sandboxMachineImageBuildRegion: { findMany: vi.fn() }
};

vi.mock('../src/lib/regions', () => ({
  getRegionClient: vi.fn((id: string) => clients[id])
}));
vi.mock('@metorial/queue', () => ({
  combineQueueProcessors: vi.fn((list: any[]) => list),
  createQueue: vi.fn((opts: { name: string }) => {
    let queue = {
      add: vi.fn(),
      addManyWithOps: vi.fn(),
      process: (fn: (data: any) => Promise<void>) => {
        processors[opts.name] = fn;
        return fn;
      }
    };
    queues[opts.name] = queue;

    return queue;
  })
}));
vi.mock('@metorial/db', () => ({ db }));

await import('../src/queues/imageRemote');

let rootJob = () => processors['sbx/image/remote/root']!;
let regionJob = () => processors['sbx/image/remote/region']!;

let eu = { oid: 1n, id: 'aws:eu-west-1' };
let us = { oid: 2n, id: 'aws:us-east-1' };

let imageRegion = (region: typeof eu, genesisId: string) => ({
  regionOid: region.oid,
  region,
  genesisId,
  tenant: { id: `tenant_${region.oid}` }
});

let buildRegion = (region: typeof eu, genesisImageId: string) => ({
  regionOid: region.oid,
  region,
  genesisImageId,
  tenant: { id: `tenant_${region.oid}` }
});

beforeEach(() => {
  vi.clearAllMocks();
  clients['aws:eu-west-1'] = makeClient();
  clients['aws:us-east-1'] = makeClient();

  db.sandboxMachineImageRegion.findMany.mockResolvedValue([]);
  db.sandboxMachineImageBuildRegion.findMany.mockResolvedValue([]);
});

describe('image remote root job', () => {
  it('fans out one job per region that holds a copy of the image', async () => {
    db.sandboxMachineImage.findFirst.mockResolvedValue({ oid: 10n, status: 'active' });
    db.sandboxMachineImageRegion.findMany.mockResolvedValue([
      imageRegion(eu, 'gi_eu'),
      imageRegion(us, 'gi_us')
    ]);
    db.sandboxMachineImageBuildRegion.findMany.mockResolvedValue([buildRegion(us, 'gi_us')]);

    await rootJob()({ imageOid: '10' });

    expect(queues['sbx/image/remote/region']!.addManyWithOps).toHaveBeenCalledWith([
      { data: { imageOid: '10', regionOid: '1' } },
      { data: { imageOid: '10', regionOid: '2' } }
    ]);
  });

  it('ignores an image that no longer exists', async () => {
    db.sandboxMachineImage.findFirst.mockResolvedValue(null);

    await rootJob()({ imageOid: '10' });

    expect(queues['sbx/image/remote/region']!.addManyWithOps).not.toHaveBeenCalled();
  });
});

describe('image remote region job', () => {
  it('renames each Genesis image in the region once, including an image still being built', async () => {
    db.sandboxMachineImage.findFirst.mockResolvedValue({
      oid: 10n,
      status: 'active',
      name: 'renamed'
    });
    db.sandboxMachineImageRegion.findMany.mockResolvedValue([imageRegion(eu, 'gi_1')]);
    db.sandboxMachineImageBuildRegion.findMany.mockResolvedValue([
      buildRegion(eu, 'gi_1'),
      buildRegion(eu, 'gi_2')
    ]);

    await regionJob()({ imageOid: '10', regionOid: '1' });

    let update = clients['aws:eu-west-1']!.machineImage.update;
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith({
      tenantId: 'tenant_1',
      imageId: 'gi_2',
      name: 'renamed'
    });
    expect(db.sandboxMachineImageRegion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'active', regionOid: 1n })
      })
    );
  });

  it('deletes the Genesis images of a deleted image, whatever state the copies were in', async () => {
    db.sandboxMachineImage.findFirst.mockResolvedValue({ oid: 10n, status: 'deleted' });
    db.sandboxMachineImageRegion.findMany.mockResolvedValue([imageRegion(us, 'gi_us')]);

    await regionJob()({ imageOid: '10', regionOid: '2' });

    expect(clients['aws:us-east-1']!.machineImage.delete).toHaveBeenCalledWith({
      tenantId: 'tenant_2',
      imageId: 'gi_us'
    });
    expect(clients['aws:us-east-1']!.machineImage.update).not.toHaveBeenCalled();

    let where = db.sandboxMachineImageRegion.findMany.mock.calls[0]![0].where;
    expect(where).not.toHaveProperty('status');
  });

  it('skips images Genesis no longer has and retries other failures', async () => {
    let { ServiceError, notFoundError } = await import('@lowerdeck/error');
    db.sandboxMachineImage.findFirst.mockResolvedValue({ oid: 10n, status: 'deleted' });
    db.sandboxMachineImageRegion.findMany.mockResolvedValue([
      imageRegion(eu, 'gi_1'),
      imageRegion(eu, 'gi_2')
    ]);

    let remove = clients['aws:eu-west-1']!.machineImage.delete;
    remove.mockRejectedValueOnce(new ServiceError(notFoundError('machine_image', 'gi_1')));

    await regionJob()({ imageOid: '10', regionOid: '1' });
    expect(remove).toHaveBeenCalledTimes(2);

    remove.mockRejectedValueOnce(new Error('down'));
    await expect(regionJob()({ imageOid: '10', regionOid: '1' })).rejects.toThrow('down');
  });
});
