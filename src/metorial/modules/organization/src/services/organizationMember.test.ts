import { ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let countOrganizationMembersMock = vi.fn();
let updateOrganizationMemberMock = vi.fn();
let fabricFireMock = vi.fn();
let syncOrgMemberToConsumerMock = vi.fn();
let syncMemberDefaultPoliciesMock = vi.fn();
let createOrganizationActorMock = vi.fn();

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
        update: updateOrganizationMemberMock
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
        context: { ip: '127.0.0.1', ua: 'test' },
        performedBy: { oid: 3n } as any
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
        context: { ip: '127.0.0.1', ua: 'test' },
        performedBy: { oid: 3n } as any
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
        context: { ip: '127.0.0.1', ua: 'test' },
        performedBy: { oid: 3n } as any
      })
    ).rejects.toMatchObject({ data: { reason: 'last_admin' } });
  });

  it('allows removing the last admin when the caller opts out of the guard', async () => {
    let { organizationMemberService } = await import('./organizationMember');

    await expect(
      organizationMemberService.deleteOrganizationMember({
        organization: { oid: 1n } as any,
        member: { oid: 2n, role: 'admin', status: 'active' } as any,
        context: { ip: '127.0.0.1', ua: 'test' },
        performedBy: { oid: 3n } as any,
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
        context: { ip: '127.0.0.1', ua: 'test' },
        performedBy: { oid: 3n } as any
      })
    ).resolves.toMatchObject({
      id: 'orgmem_1',
      status: 'deleted'
    });

    expect(updateOrganizationMemberMock).toHaveBeenCalledTimes(1);
  });
});
