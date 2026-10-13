import { beforeEach, describe, expect, it, vi } from 'vitest';

let genesis = { spec: { list: vi.fn() } };

let db = {
  sandboxSpec: { upsert: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
  sandboxSpecRegion: { upsert: vi.fn(), updateMany: vi.fn() }
};

vi.mock('../src/lib/regions', () => ({ getRegionClient: vi.fn(() => genesis) }));
vi.mock('@metorial/cache', () => ({
  createLocallyCachedFunction: (opts: any) => {
    let cache = new Map<string, any>();

    return async (i: any) => {
      let hash = opts.getHash(i);
      if (!cache.has(hash)) cache.set(hash, await opts.provider(i));

      return cache.get(hash);
    };
  }
}));
vi.mock('@metorial/db', () => ({
  db,
  ID: { generateId: vi.fn(async (prefix: string) => `${prefix}_new`) }
}));

let { sandboxSpecService } = await import('../src/services/spec');
let { sandboxSpecInternalService } = await import('../src/internal/specInternal');

let region = { oid: 1n, id: 'aws:us-east-1', identifier: 'iad1' } as any;

let item = (id: string, identifier: string) => ({
  id,
  identifier,
  memoryMiB: 1024,
  vcpus: 1
});

describe('sandboxSpecInternalService.syncRegion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.sandboxSpec.upsert.mockImplementation(async (a: any) => ({ oid: 10n, ...a.create }));
  });

  it('upserts global and regional records across pages', async () => {
    genesis.spec.list
      .mockResolvedValueOnce({
        items: [item('s1', 'small')],
        pagination: { hasMoreAfter: true, hasMoreBefore: false }
      })
      .mockResolvedValueOnce({
        items: [item('s2', 'medium')],
        pagination: { hasMoreAfter: false, hasMoreBefore: true }
      });

    await sandboxSpecInternalService.syncRegion({ region });

    expect(genesis.spec.list).toHaveBeenNthCalledWith(2, { limit: 100, after: 's1' });
    expect(db.sandboxSpec.upsert).toHaveBeenCalledTimes(2);
    expect(db.sandboxSpecRegion.upsert).toHaveBeenCalledTimes(2);
    expect(db.sandboxSpecRegion.upsert.mock.calls[0]![0].update).toMatchObject({
      genesisId: 's1',
      status: 'active'
    });
  });

  it('marks regional records that disappeared, then orphaned global specs, deleted', async () => {
    genesis.spec.list.mockResolvedValueOnce({
      items: [item('s1', 'small')],
      pagination: { hasMoreAfter: false, hasMoreBefore: false }
    });

    await sandboxSpecInternalService.syncRegion({ region });

    expect(db.sandboxSpecRegion.updateMany).toHaveBeenCalledWith({
      where: { regionOid: 1n, status: 'active', genesisId: { notIn: ['s1'] } },
      data: { status: 'deleted' }
    });
    expect(db.sandboxSpec.updateMany).toHaveBeenCalledWith({
      where: { status: 'active', regions: { none: { status: 'active' } } },
      data: { status: 'deleted' }
    });
  });
});

describe('sandboxSpecService.resolve', () => {
  it('rejects a spec that is not available in the region', async () => {
    db.sandboxSpec.findFirst.mockResolvedValue({
      id: 'sbs_1',
      status: 'active',
      regions: [{ regionOid: 2n }]
    });

    await expect(sandboxSpecService.resolve({ specId: 'sbs_1', region })).rejects.toThrow(
      /not available/
    );
  });

  it('still returns a deleted spec but refuses to resolve it', async () => {
    db.sandboxSpec.findFirst.mockResolvedValue({
      id: 'sbs_old',
      status: 'deleted',
      regions: [{ regionOid: 1n, genesisId: 's1' }]
    });

    expect((await sandboxSpecService.get({ specId: 'sbs_old' })).status).toBe('deleted');
    await expect(sandboxSpecService.resolve({ specId: 'sbs_old', region })).rejects.toThrow(
      /no longer available/
    );
  });

  it('returns the regional record', async () => {
    db.sandboxSpec.findFirst.mockResolvedValue({
      id: 'sbs_2',
      status: 'active',
      regions: [{ regionOid: 1n, genesisId: 's1' }]
    });

    let result = await sandboxSpecService.resolve({ specId: 'sbs_2', region });

    expect(result.regional.genesisId).toBe('s1');
  });

  it('reads a spec once and serves repeats from the local cache', async () => {
    db.sandboxSpec.findFirst.mockClear();
    db.sandboxSpec.findFirst.mockResolvedValue({
      id: 'sbs_cached',
      status: 'active',
      regions: [{ regionOid: 1n, genesisId: 's1' }]
    });

    await sandboxSpecService.get({ specId: 'sbs_cached' });
    await sandboxSpecService.resolve({ specId: 'sbs_cached', region });

    expect(db.sandboxSpec.findFirst).toHaveBeenCalledTimes(1);
  });
});
