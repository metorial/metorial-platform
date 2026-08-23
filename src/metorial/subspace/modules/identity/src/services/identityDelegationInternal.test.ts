import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  delegationCreate: vi.fn(),
  delegationUpdate: vi.fn(),
  delegationFindUniqueOrThrow: vi.fn(),
  delegationRequestCreateMany: vi.fn(),
  partyCreateMany: vi.fn(),
  credentialOverrideCreateMany: vi.fn(),
  attestationCreate: vi.fn(),
  identityUpdateMany: vi.fn(),
  identityCredentialFindMany: vi.fn(),
  checkMany: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  addAfterTransactionHook: vi.fn(async (fn: () => Promise<void>) => fn()),
  db: {
    identity: { updateMany: mocks.identityUpdateMany },
    identityCredential: { findMany: mocks.identityCredentialFindMany },
    identityDelegation: {
      create: mocks.delegationCreate,
      update: mocks.delegationUpdate,
      updateMany: vi.fn(),
      findUniqueOrThrow: mocks.delegationFindUniqueOrThrow
    },
    identityDelegationParty: { createMany: mocks.partyCreateMany },
    identityDelegationCredentialOverride: {
      createMany: mocks.credentialOverrideCreateMany
    },
    identityDelegationAttestation: { create: mocks.attestationCreate },
    identityDelegationRequest: {
      createMany: mocks.delegationRequestCreateMany,
      updateMany: vi.fn()
    },
    identityDelegationConfig: { findFirst: vi.fn(), findUnique: vi.fn() }
  },
  getId: vi.fn((prefix: string) => ({ oid: 1n, id: `${prefix}_1` })),
  IdentityDelegationDeniedReason: {
    sub_delegation_denied: 'sub_delegation_denied',
    sub_delegation_depth_exceeded: 'sub_delegation_depth_exceeded'
  },
  IdentityDelegationPartyRole: {},
  IdentityDelegationPermissions: {},
  withTransaction: vi.fn(async (fn: (db: any) => Promise<any>) => {
    let { db } = await import('@metorial-subspace/db');
    return fn(db);
  })
}));

vi.mock('@metorial-subspace/list-utils', () => ({
  checkDeletedRelation: vi.fn()
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  getMetorialSolution: vi.fn(async () => ({ oid: 7 }))
}));

vi.mock('../lib/delegationChecker', () => ({
  DelegationChecker: {
    create: vi.fn(async () => ({ delegationLevel: 0, checkMany: mocks.checkMany }))
  }
}));

vi.mock('../queues/lifecycle/delegation', () => ({
  identityDelegationCreatedQueue: { add: vi.fn() },
  identityDelegationUpdatedQueue: { add: vi.fn() }
}));

vi.mock('./identityDelegation', () => ({
  delegationInclude: {}
}));

vi.mock('./identityDelegationConfig', () => ({
  identityDelegationConfigService: {
    ensureDefaultIdentityDelegationConfig: vi.fn(async () => ({
      oid: 400n,
      currentVersionOid: 401n,
      currentVersion: { subDelegationBehavior: 'deny', subDelegationDepth: 0 }
    }))
  }
}));

import { identityDelegationInternalService } from './identityDelegationInternal';

let requester = { oid: 60n, id: 'kia_requester' } as any;

let createDelegation = (d: {
  projectOid: bigint | null;
  instanceOid: bigint | null;
  asRequest?: boolean;
}) => {
  let expiresAt = new Date(Date.now() + 60_000);

  return identityDelegationInternalService.createDelegation({
    tenant: { oid: 10n, id: 'ktn_1', projectOid: d.projectOid } as any,
    environment: { oid: 20n, id: 'ken_1', instanceOid: d.instanceOid } as any,
    _internal: d.asRequest
      ? { type: 'request', requester, expiresAt }
      : { type: 'create_and_approve' },
    input: {
      identity: { oid: 300n, id: 'kid_1', actorOid: 50n } as any,
      delegatee: requester,
      permissions: ['read' as any],
      expiresAt
    }
  });
};

describe('Identity delegation creation double writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.identityCredentialFindMany.mockResolvedValue([]);
    mocks.delegationCreate.mockImplementation(async ({ data }: any) => ({
      ...data,
      oid: 500n,
      id: 'kdl_1',
      attestationOid: null
    }));
    mocks.delegationUpdate.mockImplementation(async ({ data }: any) => ({
      oid: 500n,
      id: 'kdl_1',
      status: 'active',
      ...data
    }));
    mocks.attestationCreate.mockResolvedValue({ oid: 600n, id: 'kat_1' });
    mocks.delegationFindUniqueOrThrow.mockResolvedValue({ id: 'kdl_1' });
    mocks.checkMany.mockResolvedValue(false);
  });

  it('mirrors the project and instance onto the delegation', async () => {
    await createDelegation({ projectOid: 2n, instanceOid: 3n });

    expect(mocks.delegationCreate).toHaveBeenCalledTimes(1);
    expect(mocks.delegationCreate.mock.calls[0]![0].data).toMatchObject({
      tenantOid: 10n,
      projectOid: 2n,
      environmentOid: 20n,
      instanceOid: 3n
    });
  });

  it('mirrors the project and instance onto the delegation request', async () => {
    await createDelegation({ projectOid: 2n, instanceOid: 3n, asRequest: true });

    expect(mocks.delegationRequestCreateMany).toHaveBeenCalledTimes(1);
    expect(mocks.delegationRequestCreateMany.mock.calls[0]![0].data).toMatchObject({
      tenantOid: 10n,
      projectOid: 2n,
      environmentOid: 20n,
      instanceOid: 3n
    });
  });

  it('writes null when the tenant and environment are not linked yet', async () => {
    await createDelegation({ projectOid: null, instanceOid: null, asRequest: true });

    let delegationData = mocks.delegationCreate.mock.calls[0]![0].data;
    let requestData = mocks.delegationRequestCreateMany.mock.calls[0]![0].data;

    expect(delegationData.projectOid).toBeNull();
    expect(delegationData.instanceOid).toBeNull();
    expect(delegationData.tenantOid).toBe(10n);
    expect(delegationData.environmentOid).toBe(20n);

    expect(requestData.projectOid).toBeNull();
    expect(requestData.instanceOid).toBeNull();
    expect(requestData.tenantOid).toBe(10n);
    expect(requestData.environmentOid).toBe(20n);
  });
});
