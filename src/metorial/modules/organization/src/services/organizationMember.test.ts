import { ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let countOrganizationMembersMock = vi.fn();
let updateOrganizationMemberMock = vi.fn();
let findFirstOrganizationMemberMock = vi.fn();
let fabricFireMock = vi.fn();
let syncOrgMemberToConsumerMock = vi.fn();
let syncMemberDefaultPoliciesMock = vi.fn();
let createOrganizationActorMock = vi.fn();

let testAuditScope = {
  organizationOid: 1n,
  organizationActorOid: 3n,
  actor: { type: 'org_actor' as const, id: 'actor_1' },
  context: { ip: '127.0.0.1', ua: 'test' }
};

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: {
    create: vi.fn()
  }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({
      build: () => factory()
    })
  }
}));

vi.mock('@metorial/db', () => ({
  addAfterTransactionHook: vi.fn(),
  addAwaitedAfterTransactionHook: vi.fn(),
  db: {
    organizationMember: {
      count: countOrganizationMembersMock
    }
  },
  ID: {
    generateId: vi.fn()
  },
  withTransaction: async (cb: (db: unknown) => Promise<unknown>) =>
    await cb({
      organizationMember: {
        count: countOrganizationMembersMock,
        update: updateOrganizationMemberMock,
        findFirst: findFirstOrganizationMemberMock
      }
    })
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    fire: fabricFireMock
  }
}));

vi.mock('@metorial/module-consumer', () => ({
  syncOrgMemberToConsumer: syncOrgMemberToConsumerMock
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  metorialResourceService: {
    syncOrganizationMember: vi.fn()
  }
}));

vi.mock('./accessPolicyAssignment', () => ({
  accessPolicyAssignmentService: {
    syncMemberDefaultPolicies: syncMemberDefaultPoliciesMock
  }
}));

vi.mock('./organizationActor', () => ({
  organizationActorService: {
    createOrganizationActor: createOrganizationActorMock
  }
}));

describe('organizationMemberService admin removal safeguards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    countOrganizationMembersMock.mockResolvedValue(0);
    updateOrganizationMemberMock.mockImplementation(async ({ data }: { data: unknown }) => ({
      id: 'orgmem_1',
      ...((data ?? {}) as object)
    }));
  });

  it('rejects deleting the last human admin', async () => {
    let { organizationMemberService } = await import('./organizationMember');

    await expect(
      organizationMemberService.deleteOrganizationMember({
        organization: { oid: 1n } as any,
        member: { oid: 2n, role: 'admin', status: 'active' } as any,
        auditScope: testAuditScope as any
      })
    ).rejects.toBeInstanceOf(ServiceError);

    expect(updateOrganizationMemberMock).not.toHaveBeenCalled();
  });

  it('rejects demoting the last human admin', async () => {
    let { organizationMemberService } = await import('./organizationMember');

    await expect(
      organizationMemberService.updateOrganizationMember({
        organization: { oid: 1n, authVersion: 'v2' } as any,
        member: { oid: 2n, role: 'admin', status: 'active', actorOid: 4n } as any,
        input: { role: 'member' },
        auditScope: testAuditScope as any
      })
    ).rejects.toBeInstanceOf(ServiceError);

    expect(updateOrganizationMemberMock).not.toHaveBeenCalled();
  });

  it('tags the last admin rejection so callers can recognize it', async () => {
    let { organizationMemberService } = await import('./organizationMember');

    await expect(
      organizationMemberService.deleteOrganizationMember({
        organization: { oid: 1n } as any,
        member: { oid: 2n, role: 'admin', status: 'active' } as any,
        auditScope: testAuditScope as any
      })
    ).rejects.toMatchObject({ data: { reason: 'last_admin' } });
  });

  it('allows removing the last admin when the caller opts out of the guard', async () => {
    let { organizationMemberService } = await import('./organizationMember');

    await expect(
      organizationMemberService.deleteOrganizationMember({
        organization: { oid: 1n } as any,
        member: { oid: 2n, role: 'admin', status: 'active' } as any,
        auditScope: testAuditScope as any,
        allowLastAdminRemoval: true
      })
    ).resolves.toMatchObject({ status: 'deleted' });

    expect(countOrganizationMembersMock).not.toHaveBeenCalled();
  });

  it('allows deleting an admin when another admin exists', async () => {
    countOrganizationMembersMock.mockResolvedValue(1);

    let { organizationMemberService } = await import('./organizationMember');

    await expect(
      organizationMemberService.deleteOrganizationMember({
        organization: { oid: 1n } as any,
        member: { oid: 2n, role: 'admin', status: 'active' } as any,
        auditScope: testAuditScope as any
      })
    ).resolves.toMatchObject({
      id: 'orgmem_1',
      status: 'deleted'
    });

    expect(updateOrganizationMemberMock).toHaveBeenCalledTimes(1);
  });
});

describe('organizationMemberService.createOrganizationMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateOrganizationMemberMock.mockImplementation(async ({ data }: { data: unknown }) => ({
      id: 'orgmem_1',
      ...((data ?? {}) as object)
    }));
  });

  // Anything asking whether the seat is live reads the timestamp, so leaving the old one behind
  // makes a member who is back look removed.
  it('clears the removal timestamp when a removed member is added again', async () => {
    findFirstOrganizationMemberMock.mockResolvedValue({
      oid: 2n,
      status: 'deleted',
      deletedAt: new Date(),
      actor: { oid: 3n }
    });

    let { organizationMemberService } = await import('./organizationMember');

    await organizationMemberService.createOrganizationMember({
      user: { oid: 4n, type: 'user', email: 'a@b.c', name: 'A' } as any,
      organization: { oid: 1n, authVersion: 'v2' } as any,
      input: { role: 'member' },
      auditScope: testAuditScope as any
    });

    expect(updateOrganizationMemberMock).toHaveBeenCalledTimes(1);
    expect(updateOrganizationMemberMock.mock.calls[0]![0].data).toMatchObject({
      status: 'active',
      deletedAt: null
    });
  });
});
