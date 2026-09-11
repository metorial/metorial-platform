import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  environmentProviderFindFirst: vi.fn(),
  environmentProviderUpsert: vi.fn(),
  providerDeploymentCreate: vi.fn(),
  providerDeploymentVersionCreate: vi.fn(),
  providerDeploymentFindFirstOrThrow: vi.fn(),
  getCurrentVersion: vi.fn(),
  createBackendProviderDeployment: vi.fn()
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
    environmentProvider: {
      findFirst: mocks.environmentProviderFindFirst,
      upsert: mocks.environmentProviderUpsert
    },
    providerDeployment: {
      create: mocks.providerDeploymentCreate,
      update: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      findFirstOrThrow: mocks.providerDeploymentFindFirstOrThrow,
      findMany: vi.fn()
    },
    providerDeploymentVersion: { create: mocks.providerDeploymentVersionCreate },
    providerSpecification: { findFirstOrThrow: vi.fn() },
    integrationProvider: { findFirst: vi.fn() }
  },
  getId: vi.fn(() => ({ oid: 20n, id: 'pdp_1' })),
  ID: { idPrefixes: { environmentProvider: 'env' } },
  snowflake: { nextId: vi.fn(() => 40n) },
  withTransaction: vi.fn(async (fn: (db: unknown) => unknown) => {
    let { db } = await import('@metorial-subspace/db');
    return fn(db);
  }),
  addAfterTransactionHook: vi.fn(async () => {})
}));

vi.mock('@metorial-subspace/list-utils', () => ({
  assertNoActiveIdentityCredentialDeploymentLink: vi.fn(),
  assertNoActiveIntegrationInstanceProviderDeploymentLink: vi.fn(),
  checkDeletedEdit: vi.fn(),
  checkDeletedRelation: vi.fn(),
  normalizeDateFilter: vi.fn(),
  normalizeStatusForGet: vi.fn(() => ({ noParent: {} })),
  normalizeStatusForList: vi.fn(() => ({ noParent: {} })),
  resolveIdentities: vi.fn(),
  resolveIdentityActors: vi.fn(),
  resolveIdentityCredentials: vi.fn(),
  resolveProviders: vi.fn(),
  resolveProviderVersions: vi.fn()
}));

vi.mock('@metorial-subspace/module-catalog', () => ({
  getProviderCapabilityFilter: vi.fn(() => null)
}));

vi.mock('@metorial-subspace/module-provider-internal', () => ({
  checkProviderMatch: vi.fn(),
  normalizeToolFilters: vi.fn(() => ({ type: 'v1.allow_all' })),
  providerDeploymentInternalService: { getCurrentVersion: mocks.getCurrentVersion }
}));

vi.mock('@metorial-subspace/module-enclave', () => ({
  enclaveInternalService: { ensureEnclaveForProviderDeployment: vi.fn() }
}));

vi.mock('@metorial-subspace/module-search', () => ({
  voyager: { record: { search: vi.fn() } },
  voyagerIndex: { providerDeployment: { id: 'idx_1' } },
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
    deployment: { createProviderDeployment: mocks.createBackendProviderDeployment }
  }))
}));

vi.mock('@metorial-subspace/provider-utils', () => ({
  normalizeJsonSchema: vi.fn(() => null)
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));

vi.mock('../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost:6379' } }
}));

vi.mock('../queues/lifecycle/providerDeployment', () => ({
  providerDeploymentArchivedQueue: { add: vi.fn() },
  providerDeploymentCreatedQueue: { add: vi.fn() },
  providerDeploymentUpdatedQueue: { add: vi.fn() }
}));

vi.mock('./providerConfig', () => ({
  providerConfigService: { createProviderConfigInternal: vi.fn() }
}));

import { providerDeploymentService } from './providerDeployment';

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

let createDeployment = (tenant: any, environment: any) =>
  providerDeploymentService.createProviderDeploymentInternal({
    tenant,
    environment,
    provider,
    input: { config: { type: 'none' } }
  });

describe('Provider deployment creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.environmentProviderFindFirst.mockResolvedValue(null);
    mocks.createBackendProviderDeployment.mockResolvedValue({});
    mocks.getCurrentVersion.mockResolvedValue(null);
    mocks.providerDeploymentCreate.mockResolvedValue({
      oid: 20n,
      id: 'pdp_1',
      isDefault: false,
      currentVersion: null
    });
    mocks.providerDeploymentVersionCreate.mockResolvedValue({ oid: 21n });
    mocks.providerDeploymentFindFirstOrThrow.mockResolvedValue({ oid: 20n, id: 'pdp_1' });
  });

  it('mirrors the tenant project and environment instance onto the created deployment', async () => {
    await createDeployment(makeTenant(), makeEnvironment());

    expect(mocks.providerDeploymentCreate).toHaveBeenCalledTimes(1);
    expect(mocks.providerDeploymentCreate.mock.calls[0]![0].data).toMatchObject({
      tenantOid: 1n,
      projectOid: 2n,
      solutionOid: 1,
      environmentOid: 3n,
      instanceOid: 4n
    });
  });

  it('mirrors the references onto the backfilled environment provider', async () => {
    await createDeployment(makeTenant(), makeEnvironment());

    expect(mocks.environmentProviderUpsert).toHaveBeenCalledTimes(1);
    let call = mocks.environmentProviderUpsert.mock.calls[0]![0];

    expect(call.create).toMatchObject({
      tenantOid: 1n,
      projectOid: 2n,
      solutionOid: 1,
      environmentOid: 3n,
      instanceOid: 4n,
      providerOid: 5n
    });
    expect(call.where).toEqual({
      tenantOid_providerOid: { tenantOid: 1n, providerOid: 5n }
    });
  });

  it('writes null when the tenant and environment are not linked yet', async () => {
    await createDeployment(
      makeTenant({ projectOid: null }),
      makeEnvironment({ instanceOid: null })
    );

    let deploymentData = mocks.providerDeploymentCreate.mock.calls[0]![0].data;
    let environmentProviderData = mocks.environmentProviderUpsert.mock.calls[0]![0].create;

    expect(deploymentData.projectOid).toBeNull();
    expect(deploymentData.instanceOid).toBeNull();
    expect(deploymentData.tenantOid).toBe(1n);
    expect(deploymentData.environmentOid).toBe(3n);

    expect(environmentProviderData.projectOid).toBeNull();
    expect(environmentProviderData.instanceOid).toBeNull();
  });
});
