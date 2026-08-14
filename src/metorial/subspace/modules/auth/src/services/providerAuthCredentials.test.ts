import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  providerAuthCredentialsCreate: vi.fn(),
  providerAuthCredentialsUpdate: vi.fn(),
  providerAuthCredentialsUpdateMany: vi.fn(),
  addAfterTransactionHook: vi.fn(),
  queueAdd: vi.fn(),
  backendCreateProviderAuthCredentials: vi.fn(),
  backendGetScopes: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/lock', () => ({
  createLock: vi.fn(() => ({ usingLock: (_keys: unknown, fn: () => unknown) => fn() }))
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: { create: vi.fn(), validate: vi.fn() }
}));

vi.mock('@metorial-subspace/db', () => {
  let db = {
    providerAuthCredentials: {
      create: mocks.providerAuthCredentialsCreate,
      update: mocks.providerAuthCredentialsUpdate,
      updateMany: mocks.providerAuthCredentialsUpdateMany,
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn()
    },
    managedProviderAuthCredentials: { findFirstOrThrow: vi.fn() },
    managedProviderAuthCredentialsBacking: { findFirstOrThrow: vi.fn() },
    integrationProvider: { findFirst: vi.fn() }
  };

  return {
    db,
    withTransaction: (fn: (tx: typeof db) => unknown) => fn(db),
    addAfterTransactionHook: mocks.addAfterTransactionHook,
    getId: (prefix: string) => ({ oid: 1n, id: `${prefix}_test` })
  };
});

vi.mock('@metorial-subspace/list-utils', () => ({
  assertNoActiveIntegrationInstanceProviderAuthCredentialsLink: vi.fn(),
  checkDeletedEdit: vi.fn(),
  normalizeDateFilter: vi.fn(),
  normalizeStatusForGet: vi.fn(() => ({ noParent: {} })),
  normalizeStatusForList: vi.fn(() => ({ noParent: {} })),
  resolveAuthMethodsGlobal: vi.fn(),
  resolveProviders: vi.fn()
}));

vi.mock('@metorial-subspace/module-search', () => ({
  voyager: { record: { search: vi.fn() } },
  voyagerIndex: { providerAuthCredentials: { id: 'idx' } },
  voyagerSource: Promise.resolve({ id: 'src' })
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  getMetorialSolution: vi.fn(async () => ({ oid: 7, id: 'sol_1' })),
  resolveMetorialFacing: vi.fn(),
  resolveMetorialFacingWithOptionalActor: vi.fn(),
  toProviderEventBase: vi.fn()
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));

vi.mock('@metorial-subspace/provider', () => ({
  getBackend: vi.fn(async () => ({
    backend: { oid: 60n },
    auth: {
      createProviderAuthCredentials: mocks.backendCreateProviderAuthCredentials,
      getProviderAuthCredentialsScopes: mocks.backendGetScopes
    }
  }))
}));

vi.mock('../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost:6379' } }
}));

vi.mock('../lib/managedProviderAuthCredentialsBacking', () => ({
  ensureManagedProviderAuthCredentialsBacking: vi.fn()
}));

vi.mock('../queues/lifecycle/providerAuthCredentials', () => ({
  providerAuthCredentialsArchivedQueue: { add: mocks.queueAdd },
  providerAuthCredentialsCreatedQueue: { add: mocks.queueAdd },
  providerAuthCredentialsUpdatedQueue: { add: mocks.queueAdd }
}));

import { providerAuthCredentialsService } from './providerAuthCredentials';

let makeParams = ({
  projectOid = 20n as bigint | null,
  instanceOid = 40n as bigint | null
} = {}) => ({
  tenant: { oid: 10n, projectOid } as any,
  environment: { oid: 30n, instanceOid } as any,
  provider: {
    oid: 50n,
    defaultVariant: { oid: 51n, backendOid: 60n },
    type: {
      attributes: { auth: { oauth: { oauthAutoRegistration: { status: 'supported' } } } }
    }
  } as any,
  input: {
    config: {
      type: 'oauth' as const,
      clientId: 'client',
      clientSecret: 'secret',
      scopes: ['read']
    }
  }
});

describe('createProviderAuthCredentialsInternal double writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.backendCreateProviderAuthCredentials.mockResolvedValue({
      type: 'oauth',
      isAutoRegistration: false,
      slateOAuthCredentials: undefined,
      shuttleOAuthCredentials: undefined
    });
    mocks.backendGetScopes.mockResolvedValue({ scopes: ['read'] });
    mocks.providerAuthCredentialsCreate.mockResolvedValue({
      oid: 100n,
      id: 'pacr_1',
      backendOid: 60n,
      isDefault: false
    });
    mocks.providerAuthCredentialsUpdate.mockResolvedValue({ oid: 100n, id: 'pacr_1' });
  });

  it('mirrors the tenant project and environment instance onto the credentials', async () => {
    await providerAuthCredentialsService.createProviderAuthCredentialsInternal(
      makeParams() as any
    );

    expect(mocks.providerAuthCredentialsCreate).toHaveBeenCalledTimes(1);
    expect(mocks.providerAuthCredentialsCreate.mock.calls[0]![0].data).toMatchObject({
      tenantOid: 10n,
      projectOid: 20n,
      environmentOid: 30n,
      instanceOid: 40n
    });
  });

  it('keeps the mirrored oids null while the tenant is not linked yet', async () => {
    await providerAuthCredentialsService.createProviderAuthCredentialsInternal(
      makeParams({ projectOid: null, instanceOid: null }) as any
    );

    expect(mocks.providerAuthCredentialsCreate.mock.calls[0]![0].data).toMatchObject({
      tenantOid: 10n,
      projectOid: null,
      environmentOid: 30n,
      instanceOid: null
    });
  });

  it('does not add project or instance filters to the default-credentials cleanup', async () => {
    mocks.providerAuthCredentialsCreate.mockResolvedValue({
      oid: 100n,
      id: 'pacr_1',
      backendOid: 60n,
      isDefault: true
    });

    await providerAuthCredentialsService.createProviderAuthCredentialsInternal(
      makeParams() as any
    );

    expect(mocks.providerAuthCredentialsUpdateMany).toHaveBeenCalledTimes(1);
    let where = mocks.providerAuthCredentialsUpdateMany.mock.calls[0]![0].where;
    expect(where).toMatchObject({ tenantOid: 10n, environmentOid: 30n });
    expect(where).not.toHaveProperty('projectOid');
    expect(where).not.toHaveProperty('instanceOid');
  });
});
