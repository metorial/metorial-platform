import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  let cached = new Map<string, unknown>();

  return {
    cached,
    cachedFunctions: [] as any[],
    portalFindFirst: vi.fn(),
    portalFindUnique: vi.fn(),
    enrichConsumerSurfaces: vi.fn(async (d: { consumerSurfaces: any[] }) => d.consumerSurfaces)
  };
});

vi.mock('@metorial/cache', () => ({
  createCachedFunction: (opts: any) => {
    let run = async (input: any) => {
      let hash = opts.getHash(input);
      if (!mocks.cached.has(hash)) mocks.cached.set(hash, await opts.provider(input, {}));
      return mocks.cached.get(hash);
    };
    let fn = Object.assign(run, {
      opts,
      clearAndWait: vi.fn(async (input: any) => {
        mocks.cached.delete(opts.getHash(input));
      }),
      clearByTag: vi.fn()
    });
    mocks.cachedFunctions.push(fn);
    return fn;
  }
}));

vi.mock('@metorial/db', () => ({
  db: {
    portal: { findFirst: mocks.portalFindFirst, findUnique: mocks.portalFindUnique },
    cellPortal: { findFirst: vi.fn() }
  },
  ID: { generateId: vi.fn() },
  Prisma: { DbNull: 'DB_NULL' },
  withTransaction: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: { create: vi.fn((_name, factory) => ({ build: () => factory() })) }
}));

vi.mock('@lowerdeck/slugify', () => ({
  createSlugGenerator: vi.fn(() => vi.fn())
}));

vi.mock('@metorial/fabric', () => ({ Fabric: { fire: vi.fn() } }));

vi.mock('@metorial/consumer-oauth-utils', () => ({
  getPortalAllowedRedirectUrlFilters: vi.fn(),
  portalAllowedRedirectUrlFiltersEqual: vi.fn(),
  validatePortalAllowedRedirectUrlFilters: vi.fn()
}));

vi.mock('@metorial/module-consumer-core', () => ({
  consumerSurfaceService: { enrichConsumerSurfaces: mocks.enrichConsumerSurfaces }
}));

vi.mock('@metorial/module-organization', () => ({}));

vi.mock('@metorial/portal-url', () => ({}));

import { portalService } from '../src/services/portal';

let activePortal = {
  oid: 10n,
  id: 'prt_1',
  slug: 'acme',
  status: 'active',
  surface: {
    id: 'csf_1',
    status: 'active',
    publishableApiKey: { secrets: [{ secret: 'plaintext' }] }
  },
  instance: { oid: 2n }
};

describe('portalService.getPortalPublic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cached.clear();
    mocks.portalFindFirst.mockResolvedValue({ oid: activePortal.oid });
    mocks.portalFindUnique.mockResolvedValue(activePortal);
  });

  it('caches only the resolved portal oid and loads the row by primary key', async () => {
    let portal = await portalService.getPortalPublic({ portalId: 'acme' });

    expect(portal.id).toBe('prt_1');
    expect(mocks.portalFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ select: { oid: true } })
    );
    expect(mocks.portalFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { oid: activePortal.oid } })
    );
    expect([...mocks.cached.values()]).toEqual([activePortal.oid]);
  });

  it('reuses the cached oid on later lookups', async () => {
    await portalService.getPortalPublic({ portalId: 'acme' });
    await portalService.getPortalPublic({ portalId: 'acme' });

    expect(mocks.portalFindFirst).toHaveBeenCalledTimes(1);
    expect(mocks.portalFindUnique).toHaveBeenCalledTimes(2);
  });

  it('keys namespace lookups separately from id lookups', async () => {
    let [resolveOid] = mocks.cachedFunctions;

    expect(resolveOid.opts.getHash({ portalId: 'acme' })).not.toBe(
      resolveOid.opts.getHash({
        portalId: 'acme',
        namespace: { value: 'acme', compartmentValue: 'default' }
      })
    );
  });

  it('drops a cached oid whose portal is no longer active', async () => {
    let [resolveOid] = mocks.cachedFunctions;
    mocks.portalFindUnique.mockResolvedValue({ ...activePortal, status: 'archived' });

    await expect(portalService.getPortalPublic({ portalId: 'acme' })).rejects.toThrow();

    expect(resolveOid.clearAndWait).toHaveBeenCalledWith({ portalId: 'acme' });
    expect(mocks.cached.size).toBe(0);
  });
});
