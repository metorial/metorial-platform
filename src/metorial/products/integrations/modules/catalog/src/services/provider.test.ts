import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({ findFirst: vi.fn(), findMany: vi.fn() }));

vi.mock('@lowerdeck/service', () => ({
  Service: { create: (_name: string, factory: any) => ({ build: factory }) }
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: {
    create: (factory: any) => factory({ prisma: (query: any) => query({ take: 2 }) })
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: { provider: { findFirst: mocks.findFirst, findMany: mocks.findMany } },
  ProviderAuthMethodType: { token: 'token', custom: 'custom' }
}));

vi.mock('@metorial-subspace/list-utils', () => ({
  buildSearchFilter: async () => ({ listing: { id: { in: ['hidden'] } } })
}));

vi.mock('@metorial-subspace/module-provider-internal', () => ({
  providerInternalService: {}
}));

vi.mock('@metorial-subspace/module-search', () => ({
  voyager: {},
  voyagerIndex: {},
  voyagerSource: {}
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  getMetorialSolution: async () => ({ oid: 1 }),
  resolveMetorialFacing: vi.fn()
}));

vi.mock('./providerVariant', () => ({ providerVariantInclude: {} }));

import {
  getProviderTenantFilter,
  getPublicRemoteProviderVisibilityFilter,
  providerService
} from './provider';

let tenant = { oid: 20n, hidePublicRemoteProviders: true } as any;

let exclusion = {
  NOT: {
    access: 'public',
    ownerTenantOid: null,
    customProvider: { is: null },
    defaultVariant: { is: { backend: { is: { type: 'shuttle' } } } }
  }
};

describe('Public remote provider visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue(null);
    mocks.findMany.mockResolvedValue([]);
  });

  it('excludes only unowned, non-custom public Shuttle providers through scalar relations', () => {
    expect(getPublicRemoteProviderVisibilityFilter({ tenant })).toEqual(exclusion);
  });

  it.each([undefined, { hidePublicRemoteProviders: false }])(
    'preserves catalog access without an enabled policy: %s',
    value => {
      expect(
        getPublicRemoteProviderVisibilityFilter({ tenant: value as any })
      ).toBeUndefined();
    }
  );

  it('retains tenant and environment access checks alongside the exclusion', () => {
    let filter = getProviderTenantFilter({
      tenant,
      environment: { oid: 30n } as any,
      solution: { oid: 1 } as any
    });

    expect(filter.AND).toContainEqual(exclusion);
    expect(filter.AND).toContainEqual({
      OR: [
        { access: 'public' },
        {
          access: 'tenant',
          ownerTenantOid: 20n,
          OR: [{ ownerSolutionOid: 1 }, { ownerSolutionOid: null }]
        }
      ]
    });
  });

  it('keeps the exclusion when trusted providers are allowed', () => {
    let filter = getProviderTenantFilter({
      tenant: { ...tenant, onlyAllowTrustedProviders: true },
      solution: { oid: 1 } as any
    });

    expect(filter.AND).toContainEqual(exclusion);
  });

  it.each(['pro_hidden', 'slug', 'global::identifier', 'lst_hidden', 'pretty-slug', 'alias'])(
    'applies the exclusion to get lookup %s and returns not found',
    async providerId => {
      await expect(
        providerService.getProviderByIdInternal({ tenant, providerId })
      ).rejects.toThrow();

      expect(mocks.findFirst.mock.calls[0]![0].where.AND[0].AND).toContainEqual(exclusion);
    }
  );

  it('applies the exclusion to bulk id lookups', async () => {
    await providerService.getManyProvidersByIdsInternal({ tenant, ids: ['pro_hidden'] });

    expect(mocks.findMany.mock.calls[0]![0].where.AND[0].AND).toContainEqual(exclusion);
  });

  it('applies the exclusion before pagination for search and explicit ids', async () => {
    await providerService.listProvidersInternal({
      tenant,
      ids: ['pro_hidden'],
      search: 'hidden',
      includeDeprecated: true
    });

    let query = mocks.findMany.mock.calls[0]![0];
    expect(query.take).toBe(2);
    expect(query.where.AND[1].AND).toContainEqual(exclusion);
  });
});
