import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  providerAuthConfigFindMany: vi.fn(),
  providerAuthMethodFindMany: vi.fn(),
  resolveAuthMethodsGlobal: vi.fn(),
  assertCanChangeOwnerOnlyVisibility: vi.fn(),
  assertCanSeeOwnedResource: vi.fn(),
  canSeeOwnedResource: vi.fn(),
  getOwnershipAccessor: vi.fn(),
  ownedResourceWhere: vi.fn(),
  resolveOwnerActorOid: vi.fn(),
  resolveMetorialFacing: vi.fn(),
  getByIdInternal: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: {
    create: vi.fn(factory => ({
      run: (_query?: object) => factory({ prisma: (fn: (opts: object) => unknown) => fn({}) })
    })),
    validate: vi.fn()
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    providerAuthConfig: {
      findMany: mocks.providerAuthConfigFindMany
    },
    providerAuthMethod: {
      findMany: mocks.providerAuthMethodFindMany
    },
    providerDeployment: {
      findFirst: vi.fn()
    }
  },
  withTransaction: vi.fn(),
  addAfterTransactionHook: vi.fn(),
  getId: vi.fn()
}));

vi.mock('@metorial-subspace/list-utils', async () => ({
  ...(await vi.importActual<typeof import('@metorial-subspace/list-utils/src/search')>(
    '@metorial-subspace/list-utils/src/search'
  )),
  assertNoActiveIdentityCredentialAuthConfigLink: vi.fn(),
  assertNoActiveIntegrationInstanceProviderAuthConfigLink: vi.fn(),
  checkDeletedEdit: vi.fn(),
  checkDeletedRelation: vi.fn(),
  normalizeDateFilter: vi.fn(),
  normalizeStatusForGet: vi.fn(() => ({ hasParent: {} })),
  normalizeStatusForList: vi.fn(() => ({ hasParent: {} })),
  resolveAuthMethodsGlobal: mocks.resolveAuthMethodsGlobal,
  resolveIdentities: vi.fn(),
  resolveIdentityActors: vi.fn(),
  resolveIdentityCredentials: vi.fn(),
  resolveProviderAuthCredentials: vi.fn(),
  resolveProviderDeployments: vi.fn(),
  resolveProviders: vi.fn()
}));

vi.mock('@metorial-subspace/module-provider-internal', () => ({
  assertAuthMethodAllowedForTenant: vi.fn(),
  checkProviderMatch: vi.fn(),
  normalizeToolFilters: vi.fn()
}));

vi.mock('@metorial-subspace/module-search', () => ({
  voyager: { record: { search: vi.fn() } },
  voyagerIndex: { providerAuthConfig: { id: 'idx' } },
  voyagerSource: Promise.resolve({ id: 'src' })
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  assertCanChangeOwnerLock: vi.fn(),
  assertCanChangeOwnerOnlyVisibility: mocks.assertCanChangeOwnerOnlyVisibility,
  assertCanSeeOwnedResource: mocks.assertCanSeeOwnedResource,
  canSeeOwnedResource: mocks.canSeeOwnedResource,
  getOwnershipAccessor: mocks.getOwnershipAccessor,
  ownedResourceWhere: mocks.ownedResourceWhere,
  resolveOwnerActorOid: mocks.resolveOwnerActorOid,
  checkTenant: vi.fn(),
  ownerActorSelect: { select: { id: true } },
  getMetorialSolution: vi.fn(async () => ({ oid: 7, id: 'sol_1' })),
  resolveConsumerActorIds: vi.fn(),
  resolveMetorialFacing: mocks.resolveMetorialFacing,
  resolveMetorialFacingWithOptionalActor: vi.fn(),
  toProviderEventBase: vi.fn()
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));

vi.mock('../queues/lifecycle/providerAuthConfig', () => ({
  providerAuthConfigArchivedQueue: { add: vi.fn() },
  providerAuthConfigUpdatedQueue: { add: vi.fn() }
}));

vi.mock('./providerAuthConfigInternal', () => ({
  providerAuthConfigInternalService: {}
}));

vi.mock('./providerAuthCredentials', () => ({
  providerAuthCredentialsService: {}
}));

import { providerAuthConfigService } from './providerAuthConfig';

describe('listProviderAuthConfigsInternal auth method filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveAuthMethodsGlobal.mockResolvedValue({
      oids: [70n],
      in: { in: [70n] },
      oidIn: { oid: { in: [70n] } }
    });
    mocks.providerAuthConfigFindMany.mockResolvedValue([]);
    mocks.providerAuthMethodFindMany.mockResolvedValue([]);
  });

  it('matches every concrete auth method in the requested global family', async () => {
    let paginator = await providerAuthConfigService.listProviderAuthConfigsInternal({
      tenant: { oid: 10n, id: 'ten_1' } as any,
      environment: { oid: 30n } as any,
      providerAuthMethodIds: ['pam_1']
    });

    await paginator.run({});

    let where = mocks.providerAuthConfigFindMany.mock.calls[0]![0].where;

    expect(where.AND).toContainEqual({
      authMethod: {
        globalOid: {
          in: [70n]
        }
      }
    });
  });

  it('combines global auth method family and adapter compatibility filtering', async () => {
    mocks.providerAuthMethodFindMany.mockResolvedValue([
      { oid: 101n, value: { adapters: ['chat'] } },
      { oid: 102n, value: { adapters: ['mcp'] } },
      { oid: 103n, value: {} }
    ]);

    let paginator = await providerAuthConfigService.listProviderAuthConfigsInternal({
      tenant: { oid: 10n, id: 'ten_1' } as any,
      environment: { oid: 30n } as any,
      providerAuthMethodIds: ['pam_1'],
      adapter: 'chat'
    });

    await paginator.run({});

    expect(mocks.providerAuthMethodFindMany).toHaveBeenCalledWith({
      where: {
        globalOid: {
          in: [70n]
        }
      },
      select: { oid: true, value: true }
    });

    let where = mocks.providerAuthConfigFindMany.mock.calls[0]![0].where;

    expect(where.AND).toContainEqual({
      authMethod: {
        globalOid: {
          in: [70n]
        }
      }
    });
    expect(where.AND).toContainEqual({
      authMethodOid: {
        in: [101n, 103n]
      }
    });
  });
});

describe('ownership handling for provider auth configs', () => {
  let tenant = { oid: 10n, id: 'ten_1' };
  let environment = { oid: 30n };
  let accessor = { kind: 'member', isEnforced: true };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveMetorialFacing.mockResolvedValue({ tenant, environment });
    mocks.getOwnershipAccessor.mockResolvedValue(accessor);
    mocks.ownedResourceWhere.mockReturnValue({ AND: [{ marker: 'ownership' }] });
    mocks.providerAuthConfigFindMany.mockResolvedValue([]);
  });

  it('always applies the ownership where clause and passes the requested filter', async () => {
    let paginator = await providerAuthConfigService.listProviderAuthConfigs({
      instance: {} as any,
      organizationActor: { oid: 1n, type: 'member' } as any,
      ownership: 'usable'
    });
    await paginator.run({});

    expect(mocks.ownedResourceWhere).toHaveBeenCalledWith(accessor, {
      ownership: 'usable',
      includeSystemOwned: undefined
    });

    let where = mocks.providerAuthConfigFindMany.mock.calls[0]![0].where;
    expect(where.AND).toContainEqual({ AND: [{ marker: 'ownership' }] });
  });

  it('hides system owned auth configs unless explicitly included', async () => {
    let paginator = await providerAuthConfigService.listProviderAuthConfigsInternal({
      tenant: tenant as any,
      environment: environment as any
    });
    await paginator.run({});

    expect(mocks.providerAuthConfigFindMany.mock.calls[0]![0].where.isSystemOwned).toBe(false);

    let included = await providerAuthConfigService.listProviderAuthConfigsInternal({
      tenant: tenant as any,
      environment: environment as any,
      includeSystemOwned: true
    });
    await included.run({});

    expect('isSystemOwned' in mocks.providerAuthConfigFindMany.mock.calls[1]![0].where).toBe(
      false
    );
  });

  it('filters auth configs the caller cannot see from getMany', async () => {
    mocks.canSeeOwnedResource.mockImplementation((_accessor, resource) => resource.id !== 'b');
    mocks.providerAuthConfigFindMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);

    let result = await providerAuthConfigService.getManyProviderAuthConfigsByIds({
      instance: {} as any,
      organizationActor: { oid: 1n, type: 'member' } as any,
      ids: ['a', 'b']
    });

    expect(result).toEqual([{ id: 'a' }]);
    expect(mocks.providerAuthConfigFindMany.mock.calls[0]![0].where.isSystemOwned).toBe(false);
  });
});
