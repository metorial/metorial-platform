import { beforeEach, describe, expect, it, vi } from 'vitest';

let queueState = vi.hoisted(() => ({
  handlers: new Map<string, (data: any) => Promise<unknown>>(),
  queues: new Map<string, any>()
}));

vi.mock('@metorial/queue', () => ({
  QueueRetryError: class QueueRetryError extends Error {},
  combineQueueProcessors: vi.fn(processors => processors),
  createQueue: vi.fn(({ name }: { name: string }) => {
    let queue = {
      add: vi.fn(),
      addManyWithOps: vi.fn(),
      process: vi.fn((handler: (data: any) => Promise<unknown>) => {
        queueState.handlers.set(name, handler);
        return { name };
      })
    };
    queueState.queues.set(name, queue);
    return queue;
  })
}));

let db = vi.hoisted(() => ({
  project: { findUnique: vi.fn() },
  portal: { findMany: vi.fn(), findUnique: vi.fn() },
  organizationMember: { findMany: vi.fn(), findUnique: vi.fn() }
}));

vi.mock('@metorial/db', () => ({ db }));

let listeners = vi.hoisted(() => new Map<string, (event: any) => Promise<unknown>>());
vi.mock('@metorial/fabric', () => ({
  Fabric: {
    listen: vi.fn((name: string, handler: (event: any) => Promise<unknown>) =>
      listeners.set(name, handler)
    )
  }
}));

let ensureConsumerProfile = vi.hoisted(() => vi.fn());
vi.mock('@metorial/module-consumer-core', () => ({
  consumerProfileService: { ensureConsumerProfile }
}));

import '../src/queues/reconcileOrganizationMembers';

let portal = (enabled = true) => ({
  id: 'portal-1',
  status: 'active',
  organizationOid: 1n,
  organization: { id: 'org-1', oid: 1n },
  surface: { id: 'surface-1', status: 'active' },
  instance: {
    project: {
      status: 'active',
      autoAddOrganizationMembersToPortals: enabled
    }
  }
});

let member = () => ({
  id: 'member-1',
  status: 'active',
  organizationOid: 1n,
  user: {
    id: 'user-1',
    oid: 2n,
    type: 'default',
    name: 'Ada Lovelace',
    email: 'ada@example.com'
  }
});

describe('organization member portal reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a standard user-linked profile without passing the member', async () => {
    db.portal.findUnique.mockResolvedValue(portal());
    db.organizationMember.findUnique.mockResolvedValue(member());

    await queueState.handlers.get('portal/reconcile-org-members/single')!({
      portalId: 'portal-1',
      memberId: 'member-1'
    });

    expect(ensureConsumerProfile).toHaveBeenCalledWith({
      surface: expect.objectContaining({ id: 'surface-1' }),
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      user: expect.objectContaining({ id: 'user-1' }),
      auditScope: expect.objectContaining({
        organizationOid: 1n,
        actor: { type: 'system', id: 'portal/reconcileOrganizationMembers' }
      })
    });
    expect(ensureConsumerProfile.mock.calls[0]![0]).not.toHaveProperty('member');
    expect(ensureConsumerProfile.mock.calls[0]![0]).not.toHaveProperty('inviteStatus');
  });

  it('revalidates the setting before creating a profile', async () => {
    db.portal.findUnique.mockResolvedValue(portal(false));
    db.organizationMember.findUnique.mockResolvedValue(member());

    await queueState.handlers.get('portal/reconcile-org-members/single')!({
      portalId: 'portal-1',
      memberId: 'member-1'
    });

    expect(ensureConsumerProfile).not.toHaveBeenCalled();
  });

  it('fans portal members out to idempotent single jobs', async () => {
    db.portal.findUnique.mockResolvedValue(portal());
    db.organizationMember.findMany.mockResolvedValue([{ id: 'member-1' }, { id: 'member-2' }]);

    await queueState.handlers.get('portal/reconcile-org-members/many')!({
      scope: 'portal',
      portalId: 'portal-1'
    });

    expect(
      queueState.queues.get('portal/reconcile-org-members/single').addManyWithOps
    ).toHaveBeenCalledWith([
      {
        data: { portalId: 'portal-1', memberId: 'member-1' },
        opts: { id: 'portal-1-member-1' }
      },
      {
        data: { portalId: 'portal-1', memberId: 'member-2' },
        opts: { id: 'portal-1-member-2' }
      }
    ]);
  });

  it('starts reconciliation from member and portal creation events', async () => {
    await listeners.get('organization.member.created:after')!({
      member: { id: 'member-1' }
    });
    await listeners.get('portal.created:after')!({ portal: { id: 'portal-1' } });

    expect(
      queueState.queues.get('portal/reconcile-org-members/many').add
    ).toHaveBeenCalledWith(
      { scope: 'member', memberId: 'member-1' },
      { id: 'member-member-1' }
    );
    expect(
      queueState.queues.get('portal/reconcile-org-members/many').add
    ).toHaveBeenCalledWith(
      { scope: 'portal', portalId: 'portal-1' },
      { id: 'portal-portal-1' }
    );
  });
});
