import { beforeEach, describe, expect, it, vi } from 'vitest';

let genesis = { disk: { getMany: vi.fn() } };

let queues: Record<string, { add: any; addMany: any }> = {};
let processors: Record<string, (data: any) => Promise<void>> = {};
let sandboxing = { enabled: true };
let assignNumbers = vi.fn();

let db = {
  sandboxDisk: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  sandboxMachineImage: { findMany: vi.fn() }
};

vi.mock('../src/lib/regions', () => ({
  getRegionClient: vi.fn(() => genesis),
  isSandboxingEnabled: vi.fn(() => sandboxing.enabled)
}));
vi.mock('../src/internal/imageVersionInternal', () => ({
  sandboxImageVersionInternalService: { assignNumbers }
}));
vi.mock('@metorial/db', () => ({ db }));
vi.mock('@metorial/queue', () => ({
  combineQueueProcessors: vi.fn((list: any[]) => list),
  hourlyPacedDelay: vi.fn(() => ({ delay: 500 })),
  createQueue: vi.fn((opts: { name: string }) => {
    let queue = {
      add: vi.fn(),
      addMany: vi.fn(),
      process: (fn: (data: any) => Promise<void>) => {
        processors[opts.name] = fn;
        return fn;
      }
    };
    queues[opts.name] = queue;

    return queue;
  })
}));

let { startSandboxBackfill } = await import('../src/queues/backfill');

let diskMany = () => processors['sbx/disk/backfill/many']!;
let diskSingle = () => processors['sbx/disk/backfill/single']!;
let versionMany = () => processors['sbx/image/version-number/backfill/many']!;
let versionSingle = () => processors['sbx/image/version-number/backfill/single']!;

let tenant = { oid: 100n, id: 'sbt_1', region: { id: 'aws:us-east-1' } };

beforeEach(() => {
  vi.resetAllMocks();
  sandboxing.enabled = true;
});

describe('disk backfill', () => {
  it('fans out the active disks that have no recorded size, one page at a time', async () => {
    db.sandboxDisk.findMany.mockResolvedValue([{ oid: 4n }, { oid: 9n }]);

    await diskMany()({});

    expect(db.sandboxDisk.findMany).toHaveBeenCalledWith({
      where: { status: 'active', sizeBytes: null },
      orderBy: { oid: 'asc' },
      take: 500,
      select: { oid: true }
    });
    expect(queues['sbx/disk/backfill/single']!.addMany).toHaveBeenCalledWith([
      { diskOid: '4' },
      { diskOid: '9' }
    ]);
    expect(queues['sbx/disk/backfill/many']!.add).not.toHaveBeenCalled();
  });

  it('continues after the last disk of a full page, and starts after the cursor', async () => {
    db.sandboxDisk.findMany.mockResolvedValue(
      Array.from({ length: 500 }, (_, index) => ({ oid: BigInt(index + 1) }))
    );

    await diskMany()({ cursor: '12' });

    expect(db.sandboxDisk.findMany.mock.calls[0]![0].where).toEqual({
      status: 'active',
      sizeBytes: null,
      oid: { gt: 12n }
    });
    expect(queues['sbx/disk/backfill/many']!.add).toHaveBeenCalledWith(
      { cursor: '500' },
      { delay: 500 }
    );
  });

  it('does nothing when no disk needs a size', async () => {
    db.sandboxDisk.findMany.mockResolvedValue([]);

    await diskMany()({});

    expect(queues['sbx/disk/backfill/single']!.addMany).not.toHaveBeenCalled();
  });

  it('records the size of a disk and fills in a missing name from Genesis', async () => {
    db.sandboxDisk.findFirst.mockResolvedValue({
      oid: 4n,
      id: 'sbd_1',
      name: null,
      tenant
    });
    genesis.disk.getMany.mockResolvedValue([
      { id: 'sbd_1', name: 'data', sizeBytes: '1073741824' }
    ]);

    await diskSingle()({ diskOid: '4' });

    expect(genesis.disk.getMany).toHaveBeenCalledWith({ tenantId: 'sbt_1', ids: ['sbd_1'] });
    expect(db.sandboxDisk.update).toHaveBeenCalledWith({
      where: { oid: 4n },
      data: { sizeBytes: 1073741824n, name: 'data' }
    });
  });

  it('keeps the name a disk already has', async () => {
    db.sandboxDisk.findFirst.mockResolvedValue({
      oid: 4n,
      id: 'sbd_1',
      name: 'renamed',
      tenant
    });
    genesis.disk.getMany.mockResolvedValue([{ id: 'sbd_1', name: 'data', sizeBytes: '2048' }]);

    await diskSingle()({ diskOid: '4' });

    expect(db.sandboxDisk.update).toHaveBeenCalledWith({
      where: { oid: 4n },
      data: { sizeBytes: 2048n }
    });
  });

  it('leaves a disk alone when Genesis no longer has it or it already has a size', async () => {
    db.sandboxDisk.findFirst.mockResolvedValueOnce({
      oid: 4n,
      id: 'sbd_1',
      name: null,
      tenant
    });
    genesis.disk.getMany.mockResolvedValueOnce([]);
    db.sandboxDisk.findFirst.mockResolvedValueOnce(null);

    await diskSingle()({ diskOid: '4' });
    await diskSingle()({ diskOid: '5' });

    expect(db.sandboxDisk.update).not.toHaveBeenCalled();
  });
});

describe('image version number backfill', () => {
  it('fans out the images that have unnumbered versions', async () => {
    db.sandboxMachineImage.findMany.mockResolvedValue([{ oid: 2n }, { oid: 3n }]);

    await versionMany()({});

    expect(db.sandboxMachineImage.findMany).toHaveBeenCalledWith({
      where: { versions: { some: { versionNumber: null } } },
      orderBy: { oid: 'asc' },
      take: 500,
      select: { oid: true }
    });
    expect(queues['sbx/image/version-number/backfill/single']!.addMany).toHaveBeenCalledWith([
      { imageOid: '2' },
      { imageOid: '3' }
    ]);
  });

  it('continues after the last image of a full page', async () => {
    db.sandboxMachineImage.findMany.mockResolvedValue(
      Array.from({ length: 500 }, (_, index) => ({ oid: BigInt(index + 1) }))
    );

    await versionMany()({ cursor: '7' });

    expect(db.sandboxMachineImage.findMany.mock.calls[0]![0].where).toEqual({
      versions: { some: { versionNumber: null } },
      oid: { gt: 7n }
    });
    expect(queues['sbx/image/version-number/backfill/many']!.add).toHaveBeenCalledWith(
      { cursor: '500' },
      { delay: 500 }
    );
  });

  it('numbers the versions of one image', async () => {
    await versionSingle()({ imageOid: '2' });

    expect(assignNumbers).toHaveBeenCalledWith({ imageOid: 2n });
  });
});

describe('startSandboxBackfill', () => {
  it('starts both backfills once', async () => {
    await startSandboxBackfill();

    expect(queues['sbx/image/version-number/backfill/many']!.add).toHaveBeenCalledWith(
      {},
      { id: 'startup-version-number' }
    );
    expect(queues['sbx/disk/backfill/many']!.add).toHaveBeenCalledWith(
      {},
      { id: 'startup-disk' }
    );
  });

  it('skips the disks when sandboxing is not enabled', async () => {
    sandboxing.enabled = false;

    await startSandboxBackfill();

    expect(queues['sbx/image/version-number/backfill/many']!.add).toHaveBeenCalled();
    expect(queues['sbx/disk/backfill/many']!.add).not.toHaveBeenCalled();
  });
});
