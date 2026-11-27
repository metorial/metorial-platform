import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  identityActorCreate: vi.fn(),
  identityActorFindUnique: vi.fn(),
  identityActorUpdate: vi.fn(),
  consumerFindUnique: vi.fn(),
  instanceConsumerFindUnique: vi.fn(),
  consumerProfileFindUnique: vi.fn(),
  identityActorFindUniqueOrThrow: vi.fn(),
  agentCreate: vi.fn(),
  agentFindUnique: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/id', () => ({
  generateCode: vi.fn(() => 'abcde')
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: { create: vi.fn() }
}));

vi.mock('@lowerdeck/slugify', () => ({
  createSlugGenerator: vi.fn(() => async (i: { input: string }) => i.input)
}));

vi.mock('@metorial-subspace/db', () => ({
  addAfterTransactionHook: vi.fn(async (fn: () => Promise<void>) => fn()),
  db: {
    identityActor: {
      create: mocks.identityActorCreate,
      findUnique: mocks.identityActorFindUnique,
      findUniqueOrThrow: mocks.identityActorFindUniqueOrThrow,
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: mocks.identityActorUpdate
    },
    consumer: { findUnique: mocks.consumerFindUnique },
    instanceConsumer: { findUnique: mocks.instanceConsumerFindUnique },
    consumerProfile: { findUnique: mocks.consumerProfileFindUnique },
    identity: { findFirst: vi.fn(async () => null) },
    agent: {
      create: mocks.agentCreate,
      findUnique: mocks.agentFindUnique,
      update: vi.fn()
    }
  },
  getId: vi.fn((prefix: string) => ({ oid: 1n, id: `${prefix}_1` })),
  IdentityActorType: { agent: 'agent', user: 'user' },
  withTransaction: vi.fn(async (fn: (db: any) => Promise<any>) => {
    let { db } = await import('@metorial-subspace/db');
    return fn(db);
  })
}));

vi.mock('@metorial-subspace/list-utils', () => ({
  assertNoActiveIntegrationActorLink: vi.fn(),
  checkDeletedEdit: vi.fn(),
  normalizeDateFilter: vi.fn(),
  normalizeStatusForGet: vi.fn(() => ({ hasParent: {} })),
  normalizeStatusForList: vi.fn(() => ({ noParent: {} })),
  resolveAgents: vi.fn()
}));

vi.mock('@metorial-subspace/module-search', () => ({
  voyager: { record: { search: vi.fn() } },
  voyagerIndex: { identityActor: { id: 'idx_1' } },
  voyagerSource: Promise.resolve({ id: 'src_1' })
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  getMetorialSolution: vi.fn(async () => ({ oid: 7 })),
  metorialDb: { consumerActor: { findFirst: vi.fn(), findMany: vi.fn() } },
  resolveConsumerActorIds: vi.fn(),
  resolveMetorialFacing: vi.fn()
}));

vi.mock('../queues/lifecycle/actor', () => ({
  identityActorCreatedQueue: { add: vi.fn() },
  identityActorDeletedQueue: { add: vi.fn() },
  identityActorUpdatedQueue: { add: vi.fn() }
}));

vi.mock('../queues/lifecycle/agent', () => ({
  agentCreatedQueue: { add: vi.fn() },
  agentDeletedQueue: { add: vi.fn() },
  agentUpdatedQueue: { add: vi.fn() }
}));

import { identityActorService } from './actor';

let makeTenant = (projectOid: bigint | null) => ({ oid: 10n, id: 'ktn_1', projectOid }) as any;

let makeEnvironment = (instanceOid: bigint | null) =>
  ({ oid: 20n, id: 'ken_1', instanceOid }) as any;

let createActor = (d: {
  projectOid: bigint | null;
  instanceOid: bigint | null;
  type?: 'agent' | 'user';
}) =>
  identityActorService.createIdentityActorInternal({
    tenant: makeTenant(d.projectOid),
    environment: makeEnvironment(d.instanceOid),
    input: {
      name: 'Support Bot',
      type: (d.type ?? 'agent') as any
    }
  });

describe('Identity actor creation double writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.identityActorCreate.mockImplementation(async ({ data }: any) => ({
      ...data,
      oid: 100n,
      id: 'kia_1'
    }));
    mocks.agentCreate.mockImplementation(async ({ data }: any) => ({
      ...data,
      oid: 200n,
      id: 'kag_1'
    }));
    mocks.identityActorFindUniqueOrThrow.mockResolvedValue({ id: 'kia_1' });
  });

  it('mirrors the project and instance onto the identity actor', async () => {
    await createActor({ projectOid: 2n, instanceOid: 3n, type: 'user' });

    expect(mocks.identityActorCreate).toHaveBeenCalledTimes(1);
    expect(mocks.identityActorCreate.mock.calls[0]![0].data).toMatchObject({
      tenantOid: 10n,
      projectOid: 2n,
      environmentOid: 20n,
      instanceOid: 3n
    });
  });

  it('mirrors the project and instance onto the agent row', async () => {
    await createActor({ projectOid: 2n, instanceOid: 3n });

    expect(mocks.agentCreate).toHaveBeenCalledTimes(1);
    expect(mocks.agentCreate.mock.calls[0]![0].data).toMatchObject({
      tenantOid: 10n,
      projectOid: 2n,
      environmentOid: 20n,
      instanceOid: 3n
    });
  });

  it('writes null when the tenant and environment are not linked yet', async () => {
    await createActor({ projectOid: null, instanceOid: null });

    let actorData = mocks.identityActorCreate.mock.calls[0]![0].data;
    let agentData = mocks.agentCreate.mock.calls[0]![0].data;

    expect(actorData.projectOid).toBeNull();
    expect(actorData.instanceOid).toBeNull();
    expect(actorData.tenantOid).toBe(10n);
    expect(actorData.environmentOid).toBe(20n);

    expect(agentData.projectOid).toBeNull();
    expect(agentData.instanceOid).toBeNull();
    expect(agentData.tenantOid).toBe(10n);
    expect(agentData.environmentOid).toBe(20n);
  });
});

describe('organization member identity actors', () => {
  let owner = { consumerId: 'con_1', instanceConsumerId: 'ico_1', consumerProfileId: 'cop_1' };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumerFindUnique.mockResolvedValue({ oid: 1n });
    mocks.instanceConsumerFindUnique.mockResolvedValue({ oid: 2n });
    mocks.consumerProfileFindUnique.mockResolvedValue({ oid: 3n, organizationMemberOid: 4n });
    mocks.identityActorCreate.mockImplementation(async ({ data }) => ({
      ...data,
      oid: 5n,
      id: 'iac_1'
    }));
    mocks.identityActorFindUniqueOrThrow.mockResolvedValue({ id: 'iac_1' });
  });

  it('persists the member type when resolving a member-owned profile', async () => {
    await identityActorService.createIdentityActorInternal({
      tenant: makeTenant(2n),
      environment: makeEnvironment(3n),
      consumerOwner: owner,
      input: { name: 'Member', type: 'organization_member' }
    });

    expect(mocks.identityActorCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'organization_member', consumerProfileOid: 3n })
      })
    );
    expect(mocks.agentCreate).not.toHaveBeenCalled();
  });

  it('repairs existing consumer actors belonging to organization members', async () => {
    mocks.identityActorFindUnique.mockResolvedValue({
      id: 'iac_1',
      oid: 5n,
      type: 'consumer',
      consumerOid: 1n,
      instanceConsumerOid: 2n,
      consumerProfileOid: 3n,
      defaultIdentityOid: null
    });
    mocks.identityActorUpdate.mockResolvedValue({ id: 'iac_1', type: 'organization_member' });

    await identityActorService.syncConsumerOwnershipInternal({
      identityActorId: 'iac_1',
      owner,
      defaultIdentityId: null
    });

    expect(mocks.identityActorUpdate).toHaveBeenCalledWith({
      where: { oid: 5n },
      data: {
        type: 'organization_member',
        consumerOid: 1n,
        instanceConsumerOid: 2n,
        consumerProfileOid: 3n,
        defaultIdentityOid: null
      }
    });
  });
});
