import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  let cached = new Map<string, unknown>();

  return {
    cached,
    cachedFunctions: [] as any[],
    portalFindFirst: vi.fn(),
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
    portal: { findFirst: mocks.portalFindFirst },
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

let oidLookups = () =>
  mocks.portalFindFirst.mock.calls.filter(([args]) => args.select?.oid === true);
let rowLoads = () => mocks.portalFindFirst.mock.calls.filter(([args]) => !!args.include);

describe('portalService.getPortalPublic', () => {
  let resolvedOid: bigint | null;
  let loadableOids: Set<bigint>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cached.clear();

    resolvedOid = activePortal.oid;
    loadableOids = new Set([activePortal.oid]);

    mocks.portalFindFirst.mockImplementation(async (args: any) => {
      if (args.select) return resolvedOid === null ? null : { oid: resolvedOid };
      return loadableOids.has(args.where.oid)
        ? { ...activePortal, oid: args.where.oid }
        : null;
    });
  });

  it('caches only the resolved portal oid', async () => {
    let portal = await portalService.getPortalPublic({ portalId: 'acme' });

    expect(portal.id).toBe('prt_1');
    expect(oidLookups()).toHaveLength(1);
    expect([...mocks.cached.values()]).toEqual([activePortal.oid]);
  });

  it('re-applies the full lookup predicate when loading the cached oid', async () => {
    let namespace = { value: 'acme', compartmentValue: 'default' };
    await portalService.getPortalPublic({ portalId: 'acme', namespace });

    let [[loadArgs]] = rowLoads();
    expect(loadArgs.where).toMatchObject({
      oid: activePortal.oid,
      status: 'active',
      surface: { status: 'active' },
      slug: 'acme',
      namespaceProperties: {
        some: {
          namespace: { value: 'acme', compartment: { value: 'default' } }
        }
      }
    });
  });

  it('reuses the cached oid on later lookups', async () => {
    await portalService.getPortalPublic({ portalId: 'acme' });
    await portalService.getPortalPublic({ portalId: 'acme' });

    expect(oidLookups()).toHaveLength(1);
    expect(rowLoads()).toHaveLength(2);
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

  it('re-resolves once when the cached portal no longer matches the lookup', async () => {
    let [resolveOid] = mocks.cachedFunctions;
    await portalService.getPortalPublic({ portalId: 'acme' });

    loadableOids = new Set([11n]);
    resolvedOid = 11n;

    let portal = await portalService.getPortalPublic({ portalId: 'acme' });

    expect(resolveOid.clearAndWait).toHaveBeenCalledWith({ portalId: 'acme' });
    expect(portal.oid).toBe(11n);
    expect([...mocks.cached.values()]).toEqual([11n]);
  });

  it('returns not found when nothing matches after re-resolving', async () => {
    await portalService.getPortalPublic({ portalId: 'acme' });

    loadableOids = new Set();

    await expect(portalService.getPortalPublic({ portalId: 'acme' })).rejects.toThrow();
    expect(rowLoads()).toHaveLength(3);
  });
});
