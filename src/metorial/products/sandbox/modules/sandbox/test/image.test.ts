import { beforeEach, describe, expect, it, vi } from 'vitest';

let genesis = {
  globalMachineImage: { list: vi.fn(), version: { list: vi.fn() } }
};

let db = {
  sandboxRegion: { findMany: vi.fn() },
  sandboxMachineImage: { upsert: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  sandboxMachineImageRegion: { upsert: vi.fn(), updateMany: vi.fn() },
  sandboxMachineImageVersion: { upsert: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  sandboxMachineImageVersionRegion: {
    upsert: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn()
  }
};

vi.mock('../src/lib/regions', () => ({ getRegionClient: vi.fn(() => genesis) }));
vi.mock('@metorial/db', () => ({
  db,
  ID: { generateId: vi.fn(async (prefix: string) => `${prefix}_new`) }
}));

let { sandboxImageInternalService } = await import('../src/internal/imageInternal');

let region = { oid: 1n, id: 'aws:us-east-1', identifier: 'iad1' } as any;

let image = (id: string, identifier: string | null, currentVersionId: string | null) => ({
  id,
  identifier,
  name: identifier,
  currentVersion: currentVersionId ? { id: currentVersionId } : null
});

let page = (items: any[], hasMoreAfter = false) => ({
  items,
  pagination: { hasMoreAfter, hasMoreBefore: false }
});

let version = (id: string, releaseKey: string | null) => ({
  id,
  releaseKey,
  digest: `sha256:${id}`
});

describe('sandboxImageInternalService.syncRegion', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.sandboxRegion.findMany.mockResolvedValue([{ oid: 1n }]);
    db.sandboxMachineImage.findMany.mockResolvedValue([]);
    db.sandboxMachineImageVersion.findMany.mockResolvedValue([]);
    db.sandboxMachineImage.upsert.mockImplementation(async (a: any) => ({
      oid: 10n,
      ...a.create
    }));
    db.sandboxMachineImageRegion.upsert.mockImplementation(async (a: any) => ({
      oid: 20n,
      ...a.create
    }));
    db.sandboxMachineImageVersion.upsert.mockImplementation(async (a: any) => ({
      oid: 30n,
      ...a.create
    }));
    db.sandboxMachineImageVersionRegion.findFirst.mockResolvedValue(null);
  });

  it('creates global, regional and version records keyed by identifier and release key', async () => {
    genesis.globalMachineImage.list.mockResolvedValueOnce(
      page([image('img_1', 'alpine-3.23', 'ver_1')])
    );
    genesis.globalMachineImage.version.list.mockResolvedValueOnce(
      page([version('ver_1', 'rk1'), version('ver_0', 'rk0')])
    );

    await sandboxImageInternalService.syncRegion({ region });

    expect(genesis.globalMachineImage.list).toHaveBeenCalledWith({
      imported: true,
      status: ['ready'],
      limit: 100,
      after: undefined
    });
    expect(db.sandboxMachineImage.upsert.mock.calls[0]![0].where).toEqual({
      identifier: 'alpine-3.23'
    });
    expect(db.sandboxMachineImageRegion.upsert.mock.calls[0]![0].update).toMatchObject({
      genesisId: 'img_1',
      status: 'active'
    });
    expect(db.sandboxMachineImageVersion.upsert).toHaveBeenCalledTimes(2);
    expect(db.sandboxMachineImageVersion.upsert.mock.calls[0]![0].where).toEqual({
      imageOid_releaseKey: { imageOid: 10n, releaseKey: 'rk1' }
    });
    expect(db.sandboxMachineImageVersionRegion.upsert.mock.calls[0]![0].create).toMatchObject({
      genesisId: 'ver_1',
      digest: 'sha256:ver_1',
      imageRegionOid: 20n
    });
  });

  it('skips images without an identifier or current version', async () => {
    genesis.globalMachineImage.list.mockResolvedValueOnce(
      page([image('img_a', null, 'v'), image('img_b', 'alpine-3.23', null)])
    );

    await sandboxImageInternalService.syncRegion({ region });

    expect(db.sandboxMachineImage.upsert).not.toHaveBeenCalled();
    expect(db.sandboxMachineImageRegion.updateMany).toHaveBeenCalledWith({
      where: { regionOid: 1n, status: 'active', genesisId: { notIn: [] } },
      data: { status: 'deleted' }
    });
  });

  it('skips listing versions when the current version is already known', async () => {
    genesis.globalMachineImage.list.mockResolvedValueOnce(
      page([image('img_1', 'alpine-3.23', 'ver_1')])
    );
    db.sandboxMachineImageVersionRegion.findFirst.mockResolvedValue({ oid: 1n });

    await sandboxImageInternalService.syncRegion({ region });

    expect(genesis.globalMachineImage.version.list).not.toHaveBeenCalled();
  });

  it('ignores versions without a release key and retires unseen regional versions', async () => {
    genesis.globalMachineImage.list.mockResolvedValueOnce(
      page([image('img_1', 'alpine-3.23', 'ver_1')])
    );
    genesis.globalMachineImage.version.list.mockResolvedValueOnce(
      page([version('ver_1', 'rk1'), version('ver_x', null)])
    );

    await sandboxImageInternalService.syncRegion({ region });

    expect(db.sandboxMachineImageVersion.upsert).toHaveBeenCalledTimes(1);
    expect(db.sandboxMachineImageVersionRegion.updateMany).toHaveBeenCalledWith({
      where: { imageRegionOid: 20n, status: 'active', genesisId: { notIn: ['ver_1'] } },
      data: { status: 'deleted' }
    });
  });

  it('pages through images', async () => {
    genesis.globalMachineImage.list
      .mockResolvedValueOnce(page([image('img_1', 'alpine-3.23', 'v1')], true))
      .mockResolvedValueOnce(page([image('img_2', 'ubuntu-24.04', 'v2')]));
    genesis.globalMachineImage.version.list.mockResolvedValue(page([]));

    await sandboxImageInternalService.syncRegion({ region });

    expect(genesis.globalMachineImage.list).toHaveBeenNthCalledWith(2, {
      imported: true,
      status: ['ready'],
      limit: 100,
      after: 'img_1'
    });
    expect(db.sandboxMachineImage.upsert).toHaveBeenCalledTimes(2);
  });

  it('deletes regional records for images and versions that disappeared', async () => {
    genesis.globalMachineImage.list.mockResolvedValueOnce(page([]));

    await sandboxImageInternalService.syncRegion({ region });

    expect(db.sandboxMachineImageRegion.updateMany).toHaveBeenCalledWith({
      where: { regionOid: 1n, status: 'active', genesisId: { notIn: [] } },
      data: { status: 'deleted' }
    });
    expect(db.sandboxMachineImageVersionRegion.updateMany).toHaveBeenCalledWith({
      where: { regionOid: 1n, status: 'active', imageRegion: { status: 'deleted' } },
      data: { status: 'deleted' }
    });
  });
});

describe('sandboxImageInternalService.refreshAvailability', () => {
  let counted = (oid: bigint, status: string, regions: number) => ({
    oid,
    status,
    _count: { regions }
  });

  beforeEach(() => {
    vi.resetAllMocks();
    db.sandboxRegion.findMany.mockResolvedValue([{ oid: 1n }, { oid: 2n }]);
    db.sandboxMachineImageVersion.findMany.mockResolvedValue([]);
  });

  it('activates images present in every active region, holds partial ones pending', async () => {
    db.sandboxMachineImage.findMany.mockResolvedValue([
      counted(1n, 'pending', 2),
      counted(2n, 'active', 1),
      counted(3n, 'active', 0),
      counted(4n, 'active', 2)
    ]);

    await sandboxImageInternalService.refreshAvailability();

    expect(db.sandboxMachineImage.updateMany).toHaveBeenCalledTimes(3);
    expect(db.sandboxMachineImage.updateMany).toHaveBeenCalledWith({
      where: { oid: { in: [2n] } },
      data: { status: 'pending', deletedAt: null }
    });
    expect(db.sandboxMachineImage.updateMany).toHaveBeenCalledWith({
      where: { oid: { in: [1n] } },
      data: { status: 'active', deletedAt: null }
    });
    expect(db.sandboxMachineImage.updateMany).toHaveBeenCalledWith({
      where: { oid: { in: [3n] } },
      data: { status: 'deleted', deletedAt: expect.any(Date) }
    });
  });

  it('applies the same rule to versions', async () => {
    db.sandboxMachineImage.findMany.mockResolvedValue([]);
    db.sandboxMachineImageVersion.findMany.mockResolvedValue([
      counted(5n, 'pending', 2),
      counted(6n, 'active', 1)
    ]);

    await sandboxImageInternalService.refreshAvailability();

    expect(db.sandboxMachineImageVersion.updateMany).toHaveBeenCalledWith({
      where: { oid: { in: [5n] } },
      data: { status: 'active' }
    });
    expect(db.sandboxMachineImageVersion.updateMany).toHaveBeenCalledWith({
      where: { oid: { in: [6n] } },
      data: { status: 'pending' }
    });
  });

  it('does nothing without active regions', async () => {
    db.sandboxRegion.findMany.mockResolvedValue([]);

    await sandboxImageInternalService.refreshAvailability();

    expect(db.sandboxMachineImage.findMany).not.toHaveBeenCalled();
  });
});
