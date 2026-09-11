import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  providerSetupSessionCreate: vi.fn(),
  providerSetupSessionFindUniqueOrThrow: vi.fn(),
  providerSetupSessionEventCreateMany: vi.fn(),
  addAfterTransactionHook: vi.fn(),
  queueAdd: vi.fn(),
  evaluate: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: { create: vi.fn(), validate: vi.fn() }
}));

vi.mock('@metorial-subspace/db', () => {
  let db = {
    providerSetupSession: {
      create: mocks.providerSetupSessionCreate,
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUniqueOrThrow: mocks.providerSetupSessionFindUniqueOrThrow
    },
    providerSetupSessionEvent: {
      createMany: mocks.providerSetupSessionEventCreateMany,
      findMany: vi.fn()
    },
    provider: { findFirstOrThrow: vi.fn() },
    identity: { findFirst: vi.fn() }
  };

  return {
    db,
    withTransaction: (fn: (tx: typeof db) => unknown) => fn(db),
    addAfterTransactionHook: mocks.addAfterTransactionHook,
    getId: (prefix: string) => ({ oid: 1n, id: `${prefix}_test` }),
    generateRegionalClientSecret: vi.fn(async () => 'secret'),
    ProviderSetupSessionTypeConcrete: { auth_only: 'auth_only' }
  };
});

vi.mock('@metorial-subspace/list-utils', () => ({
  checkDeletedEdit: vi.fn(),
  checkDeletedRelation: vi.fn(),
  normalizeDateFilter: vi.fn(),
  normalizeStatusForGet: vi.fn(() => ({ onlyParent: {} })),
  normalizeStatusForList: vi.fn(() => ({ onlyParent: {} })),
  resolveProviderAuthConfigs: vi.fn(),
  resolveProviderAuthCredentials: vi.fn(),
  resolveProviderAuthMethods: vi.fn(),
  resolveProviderDeployments: vi.fn(),
  resolveProviders: vi.fn()
}));

vi.mock('@metorial-subspace/module-provider-internal', () => ({
  checkProviderMatch: vi.fn()
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  getMetorialSolution: vi.fn(async () => ({ oid: 7, id: 'sol_1' })),
  metorialDb: {
    instanceConsumer: { findFirst: vi.fn() },
    consumerActor: { findFirst: vi.fn() }
  },
  resolveMetorialFacing: vi.fn(),
  resolveMetorialFacingWithOptionalActor: vi.fn(),
  toProviderEventBase: vi.fn()
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));

vi.mock('../queues/lifecycle/providerSetupSession', () => ({
  providerSetupSessionCreatedQueue: { add: mocks.queueAdd },
  providerSetupSessionUpdatedQueue: { add: mocks.queueAdd }
}));

vi.mock('./providerAuthConfig', () => ({
  providerAuthConfigInclude: {}
}));

vi.mock('./providerSetupSessionInternal', () => ({
  providerSetupSessionInternalService: {
    evaluate: mocks.evaluate,
    initializeProviderSetupSessionProvider: vi.fn()
  }
}));

import { providerSetupSessionService } from './providerSetupSession';

let makeParams = ({
  projectOid = 20n as bigint | null,
  instanceOid = 40n as bigint | null
} = {}) => ({
  tenant: { oid: 10n, projectOid } as any,
  environment: { oid: 30n, instanceOid } as any,
  input: {
    type: 'auto' as const,
    uiMode: 'metorial_elements' as const
  },
  import: { ip: '127.0.0.1', ua: 'test-agent' }
});

describe('createProviderSetupSessionInternal double writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.providerSetupSessionCreate.mockResolvedValue({ oid: 100n, id: 'pss_1' });
    mocks.providerSetupSessionFindUniqueOrThrow.mockResolvedValue({ oid: 100n, id: 'pss_1' });
  });

  it('mirrors the tenant project and environment instance onto the setup session', async () => {
    await providerSetupSessionService.createProviderSetupSessionInternal(makeParams() as any);

    expect(mocks.providerSetupSessionCreate).toHaveBeenCalledTimes(1);
    expect(mocks.providerSetupSessionCreate.mock.calls[0]![0].data).toMatchObject({
      tenantOid: 10n,
      projectOid: 20n,
      environmentOid: 30n,
      instanceOid: 40n
    });
  });

  it('keeps the mirrored oids null while the tenant is not linked yet', async () => {
    await providerSetupSessionService.createProviderSetupSessionInternal(
      makeParams({ projectOid: null, instanceOid: null }) as any
    );

    expect(mocks.providerSetupSessionCreate.mock.calls[0]![0].data).toMatchObject({
      tenantOid: 10n,
      projectOid: null,
      environmentOid: 30n,
      instanceOid: null
    });
  });
});
