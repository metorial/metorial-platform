import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  providerAuthConfigFindMany: vi.fn(),
  providerAuthMethodFindMany: vi.fn(),
  resolveAuthMethodsGlobal: vi.fn()
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

vi.mock('@metorial-subspace/list-utils', () => ({
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
  checkTenant: vi.fn(),
  getMetorialSolution: vi.fn(async () => ({ oid: 7, id: 'sol_1' })),
  resolveConsumerActorIds: vi.fn(),
  resolveMetorialFacing: vi.fn(),
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
