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
let flags = { 'sandbox-max-memory-gib': 32, 'sandbox-max-vcpus': 16 };

vi.mock('@metorial/module-flags', () => ({
  flagService: { getFlags: vi.fn(async () => flags) }
}));
vi.mock('@metorial/db', () => ({
  db,
  ID: { generateId: vi.fn(async (prefix: string) => `${prefix}_new`) }
}));

let { sandboxSpecService, sandboxSpecIdentifier, isSandboxSpecAvailable } =
  await import('../src/services/spec');
let { sandboxSpecInternalService } = await import('../src/internal/specInternal');

let region = { oid: 1n, id: 'aws:us-east-1', identifier: 'iad1' } as any;
let organization = { oid: 5n } as any;

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

describe('sandboxSpecIdentifier', () => {
  it('encodes memory in MiB and cpus in milli-vCPUs', () => {
    expect(sandboxSpecIdentifier({ memoryGib: 3, cpus: 3 })).toBe('m3072-c3000');
    expect(sandboxSpecIdentifier({ memoryGib: 0.5, cpus: 0.5 })).toBe('m512-c500');
  });
});

describe('isSandboxSpecAvailable', () => {
  let limits = { 'sandbox-max-memory-gib': 8, 'sandbox-max-vcpus': 4 };

  it('allows specs within both limits', () => {
    expect(
      isSandboxSpecAvailable({ spec: { memoryMiB: 8192, vcpus: 4 }, flags: limits })
    ).toBe(true);
  });

  it('rejects specs above either limit', () => {
    expect(
      isSandboxSpecAvailable({ spec: { memoryMiB: 8704, vcpus: 4 }, flags: limits })
    ).toBe(false);
    expect(
      isSandboxSpecAvailable({ spec: { memoryMiB: 8192, vcpus: 4.5 }, flags: limits })
    ).toBe(false);
  });
});

describe('sandboxSpecService.select', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.sandboxSpec.findFirst.mockResolvedValue({ id: 'sbs_3', status: 'active', regions: [] });
  });

  it('looks up memory_gib and cpus by identifier', async () => {
    await sandboxSpecService.select({ selector: { memoryGib: 3, cpus: 3 } });

    expect(db.sandboxSpec.findFirst.mock.calls[0]![0].where).toEqual({
      identifier: 'm3072-c3000',
      status: 'active'
    });
  });

  it('looks up a spec identifier directly', async () => {
    await sandboxSpecService.select({ selector: { specIdentifier: 'm512-c500' } });

    expect(db.sandboxSpec.findFirst.mock.calls[0]![0].where.identifier).toBe('m512-c500');
  });

  it('rejects an identifier without a persisted virtual spec', async () => {
    db.sandboxSpec.findFirst.mockResolvedValue(null);

    await expect(
      sandboxSpecService.select({ selector: { memoryGib: 1, cpus: 14 } })
    ).rejects.toThrow(/no machine spec/);
  });

  it('requires exactly one selector', async () => {
    await expect(sandboxSpecService.select({ selector: {} })).rejects.toThrow(/exactly one/);
    await expect(
      sandboxSpecService.select({ selector: { specId: 'a', specIdentifier: 'b' } })
    ).rejects.toThrow(/exactly one/);
    await expect(
      sandboxSpecService.select({ selector: { specId: 'a', memoryGib: 1, cpus: 1 } })
    ).rejects.toThrow(/exactly one/);
  });

  it('requires memory_gib and cpus together', async () => {
    await expect(sandboxSpecService.select({ selector: { memoryGib: 1 } })).rejects.toThrow(
      /together/
    );
  });
});

describe('sandboxSpecService.resolve', () => {
  it('rejects a spec above the plan limits', async () => {
    db.sandboxSpec.findFirst.mockResolvedValue({
      id: 'sbs_big',
      identifier: 'm16384-c8000',
      status: 'active',
      memoryMiB: 16384,
      vcpus: 8,
      regions: [{ regionOid: 1n, genesisId: 'm16384-c8000' }]
    });
    flags['sandbox-max-memory-gib'] = 8;
    flags['sandbox-max-vcpus'] = 4;

    await expect(
      sandboxSpecService.resolve({ selector: { specId: 'sbs_big' }, region, organization })
    ).rejects.toThrow(/not available on your plan/);

    flags['sandbox-max-memory-gib'] = 32;
    flags['sandbox-max-vcpus'] = 16;
  });

  it('rejects a spec that is not available in the region', async () => {
    db.sandboxSpec.findFirst.mockResolvedValue({
      id: 'sbs_1',
      status: 'active',
      regions: [{ regionOid: 2n }]
    });

    await expect(
      sandboxSpecService.resolve({ selector: { specId: 'sbs_1' }, region, organization })
    ).rejects.toThrow(/not available/);
  });

  it('still returns a deleted spec but refuses to resolve it', async () => {
    db.sandboxSpec.findFirst.mockResolvedValue({
      id: 'sbs_old',
      status: 'deleted',
      regions: [{ regionOid: 1n, genesisId: 's1' }]
    });

    expect((await sandboxSpecService.get({ specId: 'sbs_old' })).status).toBe('deleted');
    await expect(
      sandboxSpecService.resolve({ selector: { specId: 'sbs_old' }, region, organization })
    ).rejects.toThrow(/no longer available/);
  });

  it('returns the regional record', async () => {
    db.sandboxSpec.findFirst.mockResolvedValue({
      id: 'sbs_2',
      status: 'active',
      memoryMiB: 1024,
      vcpus: 1,
      regions: [{ regionOid: 1n, genesisId: 's1' }]
    });

    let result = await sandboxSpecService.resolve({
      selector: { specId: 'sbs_2' },
      region,
      organization
    });

    expect(result.regional.genesisId).toBe('s1');
  });

  it('reads a spec once and serves repeats from the local cache', async () => {
    db.sandboxSpec.findFirst.mockClear();
    db.sandboxSpec.findFirst.mockResolvedValue({
      id: 'sbs_cached',
      status: 'active',
      memoryMiB: 1024,
      vcpus: 1,
      regions: [{ regionOid: 1n, genesisId: 's1' }]
    });

    await sandboxSpecService.get({ specId: 'sbs_cached' });
    await sandboxSpecService.resolve({
      selector: { specId: 'sbs_cached' },
      region,
      organization
    });

    expect(db.sandboxSpec.findFirst).toHaveBeenCalledTimes(1);
  });
});
