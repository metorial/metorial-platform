import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  identityCreate: vi.fn(),
  identityFindFirstOrThrow: vi.fn(),
  internalCreateIdentityCredentials: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: { create: vi.fn() }
}));

vi.mock('@metorial-subspace/db', () => ({
  addAfterTransactionHook: vi.fn(async (fn: () => Promise<void>) => fn()),
  db: {
    identity: {
      create: mocks.identityCreate,
      findFirstOrThrow: mocks.identityFindFirstOrThrow,
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn()
    }
  },
  getId: vi.fn((prefix: string) => ({ oid: 1n, id: `${prefix}_1` })),
  withTransaction: vi.fn(async (fn: (db: any) => Promise<any>) => {
    let { db } = await import('@metorial-subspace/db');
    return fn(db);
  })
}));

vi.mock('@metorial-subspace/list-utils', () => ({
  assertNoActiveIntegrationIdentityLink: vi.fn(),
  checkDeletedEdit: vi.fn(),
  checkDeletedRelation: vi.fn(),
  normalizeDateFilter: vi.fn(),
  normalizeStatusForGet: vi.fn(() => ({ hasParent: {} })),
  normalizeStatusForList: vi.fn(() => ({ noParent: {} })),
  resolveAgents: vi.fn(),
  resolveIdentities: vi.fn(),
  resolveIdentityActors: vi.fn(),
  resolveIdentityCredentials: vi.fn(),
  resolveIntegrationInstanceProviders: vi.fn(),
  resolveIntegrationInstances: vi.fn(),
  resolveIntegrations: vi.fn(),
  resolveProviderAuthConfigs: vi.fn(),
  resolveProviderConfigs: vi.fn(),
  resolveProviderDeployments: vi.fn(),
  resolveProviders: vi.fn()
}));

vi.mock('@metorial-subspace/module-search', () => ({
  voyager: { record: { search: vi.fn() } },
  voyagerIndex: { identity: { id: 'idx_1' } },
  voyagerSource: Promise.resolve({ id: 'src_1' })
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  getMetorialSolution: vi.fn(async () => ({ oid: 7 })),
  metorialDb: { consumerActor: { findFirst: vi.fn() } },
  resolveMetorialFacing: vi.fn()
}));

vi.mock('../queues/lifecycle/identity', () => ({
  identityCreatedQueue: { add: vi.fn() },
  identityDeletedQueue: { add: vi.fn() },
  identityUpdatedQueue: { add: vi.fn() }
}));

vi.mock('./identityCredential', () => ({
  identityCredentialService: {
    internalCreateIdentityCredentials: mocks.internalCreateIdentityCredentials
  }
}));

import { identityService } from './identity';

let createIdentity = (d: { projectOid: bigint | null; instanceOid: bigint | null }) =>
  identityService.createIdentityInternal({
    tenant: { oid: 10n, id: 'ktn_1', projectOid: d.projectOid } as any,
    environment: { oid: 20n, id: 'ken_1', instanceOid: d.instanceOid } as any,
    actor: { oid: 50n, id: 'kia_1' } as any,
    input: { name: 'Primary', inputs: [] }
  });

describe('Identity creation double writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.identityCreate.mockImplementation(async ({ data }: any) => ({
      ...data,
      oid: 100n,
      id: 'kid_1'
    }));
    mocks.identityFindFirstOrThrow.mockResolvedValue({ id: 'kid_1' });
    mocks.internalCreateIdentityCredentials.mockResolvedValue([]);
  });

  it('mirrors the project and instance onto the identity', async () => {
    await createIdentity({ projectOid: 2n, instanceOid: 3n });

    expect(mocks.identityCreate).toHaveBeenCalledTimes(1);
    expect(mocks.identityCreate.mock.calls[0]![0].data).toMatchObject({
      tenantOid: 10n,
      projectOid: 2n,
      environmentOid: 20n,
      instanceOid: 3n
    });
  });

  it('writes null when the tenant and environment are not linked yet', async () => {
    await createIdentity({ projectOid: null, instanceOid: null });

    let data = mocks.identityCreate.mock.calls[0]![0].data;

    expect(data.projectOid).toBeNull();
    expect(data.instanceOid).toBeNull();
    expect(data.tenantOid).toBe(10n);
    expect(data.environmentOid).toBe(20n);
  });
});
