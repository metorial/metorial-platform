import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  providerConfigCreate: vi.fn(),
  providerConfigUpdate: vi.fn(),
  providerConfigUpdateMany: vi.fn(),
  providerConfigFindFirstOrThrow: vi.fn(),
  providerConfigVersionCreate: vi.fn(),
  providerConfigUpdateCreate: vi.fn(),
  getCurrentVersionOptional: vi.fn(),
  createBackendProviderConfig: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/lock', () => ({
  createLock: vi.fn(() => ({
    usingLock: (_key: string, fn: () => unknown) => fn()
  }))
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: { create: vi.fn() }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    providerConfig: {
      create: mocks.providerConfigCreate,
      update: mocks.providerConfigUpdate,
      updateMany: mocks.providerConfigUpdateMany,
      findFirst: vi.fn(),
      findFirstOrThrow: mocks.providerConfigFindFirstOrThrow,
      findMany: vi.fn()
    },
    providerConfigVersion: { create: mocks.providerConfigVersionCreate },
    providerConfigUpdate: { create: mocks.providerConfigUpdateCreate },
    providerDeployment: { findFirst: vi.fn(), findFirstOrThrow: vi.fn(), updateMany: vi.fn() },
    providerSpecification: { findFirstOrThrow: vi.fn() },
    provider: { findFirstOrThrow: vi.fn() },
    providerVersion: { findFirstOrThrow: vi.fn() },
    integrationProvider: { findFirst: vi.fn() }
  },
  getId: vi.fn(() => ({ oid: 10n, id: 'pcf_1' })),
  withTransaction: vi.fn(async (fn: (db: unknown) => unknown) => {
    let { db } = await import('@metorial-subspace/db');
    return fn(db);
  }),
  addAfterTransactionHook: vi.fn(async () => {})
}));

vi.mock('@metorial-subspace/list-utils', () => ({
  assertNoActiveIdentityCredentialConfigLink: vi.fn(),
  assertNoActiveIntegrationInstanceProviderConfigLink: vi.fn(),
  checkDeletedEdit: vi.fn(),
  checkDeletedRelation: vi.fn(),
  normalizeDateFilter: vi.fn(),
  normalizeStatusForGet: vi.fn(() => ({ noParent: {} })),
  normalizeStatusForList: vi.fn(() => ({ noParent: {} })),
  resolveIdentities: vi.fn(),
  resolveIdentityActors: vi.fn(),
  resolveIdentityCredentials: vi.fn(),
  resolveProviderConfigs: vi.fn(),
  resolveProviderDeployments: vi.fn(),
  resolveProviders: vi.fn(),
  resolveProviderSpecifications: vi.fn()
}));

vi.mock('@metorial-subspace/module-provider-internal', () => ({
  checkProviderMatch: vi.fn(),
  normalizeToolFilters: vi.fn(() => ({ type: 'v1.allow_all' })),
  providerDeploymentConfigPairInternalService: { upsertDeploymentConfigPair: vi.fn() },
  providerDeploymentInternalService: {
    getCurrentVersionOptional: mocks.getCurrentVersionOptional
  }
}));

vi.mock('@metorial-subspace/module-search', () => ({
  voyager: { record: { search: vi.fn() } },
  voyagerIndex: { providerConfig: { id: 'idx_1' } },
  voyagerSource: Promise.resolve({ id: 'src_1' })
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  getMetorialSolution: vi.fn(async () => ({ oid: 1 })),
  resolveConsumerActorIds: vi.fn(),
  resolveMetorialFacing: vi.fn(),
  resolveMetorialFacingWithOptionalActor: vi.fn(),
  toProviderEventBase: vi.fn(() => ({}))
}));

vi.mock('@metorial-subspace/provider', () => ({
  getBackend: vi.fn(async () => ({
    deployment: { createProviderConfig: mocks.createBackendProviderConfig }
  }))
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));

vi.mock('../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost:6379' } }
}));

vi.mock('../queues/lifecycle/providerConfig', () => ({
  providerConfigArchivedQueue: { add: vi.fn() },
  providerConfigCreatedQueue: { add: vi.fn() },
  providerConfigUpdatedQueue: { add: vi.fn() }
}));

import { providerConfigService } from './providerConfig';

let makeTenant = (overrides: Record<string, unknown> = {}) =>
  ({ oid: 1n, id: 'ktn_1', projectOid: 2n, ...overrides }) as any;

let makeEnvironment = (overrides: Record<string, unknown> = {}) =>
  ({ oid: 3n, id: 'ken_1', instanceOid: 4n, ...overrides }) as any;

let provider = {
  oid: 5n,
  id: 'prv_1',
  name: 'Provider',
  defaultVariant: { oid: 6n, id: 'pvr_1', backendOid: 7n }
} as any;

describe('Provider config creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentVersionOptional.mockResolvedValue({ oid: 8n, specificationOid: 9n });
    mocks.createBackendProviderConfig.mockResolvedValue({
      slateInstance: { oid: 30n },
      shuttleServerConfig: { oid: 31n }
    });
    mocks.providerConfigCreate.mockResolvedValue({
      oid: 10n,
      id: 'pcf_1',
      isDefault: false
    });
    mocks.providerConfigVersionCreate.mockResolvedValue({ oid: 11n });
    mocks.providerConfigFindFirstOrThrow.mockResolvedValue({ oid: 10n, id: 'pcf_1' });
  });

  it('mirrors the tenant project and environment instance onto the created config', async () => {
    await providerConfigService.createProviderConfigInternal({
      tenant: makeTenant(),
      environment: makeEnvironment(),
      provider,
      input: { config: { type: 'inline', data: {} } }
    });

    expect(mocks.providerConfigCreate).toHaveBeenCalledTimes(1);
    expect(mocks.providerConfigCreate.mock.calls[0]![0].data).toMatchObject({
      tenantOid: 1n,
      projectOid: 2n,
      solutionOid: 1,
      environmentOid: 3n,
      instanceOid: 4n
    });
  });

  it('writes null when the tenant and environment are not linked yet', async () => {
    await providerConfigService.createProviderConfigInternal({
      tenant: makeTenant({ projectOid: null }),
      environment: makeEnvironment({ instanceOid: null }),
      provider,
      input: { config: { type: 'inline', data: {} } }
    });

    let data = mocks.providerConfigCreate.mock.calls[0]![0].data;

    expect(data.projectOid).toBeNull();
    expect(data.instanceOid).toBeNull();
    expect(data.tenantOid).toBe(1n);
    expect(data.environmentOid).toBe(3n);
  });
});
