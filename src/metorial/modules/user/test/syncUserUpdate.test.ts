import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({
  db: {
    user: { findUnique: vi.fn() },
    organizationMember: { findUnique: vi.fn(), update: vi.fn() },
    organizationActor: { update: vi.fn() }
  }
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));

vi.mock('@metorial/module-consumer', () => ({
  syncUserToConsumers: vi.fn()
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(config => ({
    name: config.name,
    add: vi.fn(),
    addMany: vi.fn(),
    process: vi.fn(handler => handler)
  })),
  QueueRetryError: class QueueRetryError extends Error {}
}));

describe('sync user update queues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches member and consumer synchronization', async () => {
    let { syncUserUpdateQueueProcessor } = await import('../src/queues/syncUserUpdate');
    let { syncUserUpdateConsumerManyQueue } =
      await import('../src/queues/syncUserUpdateToConsumers');
    let { syncUserUpdateMemberManyQueue } =
      await import('../src/queues/syncUserUpdateToMembers');

    await syncUserUpdateQueueProcessor({ userId: 'user_123' });

    expect(syncUserUpdateConsumerManyQueue.add).toHaveBeenCalledWith({ userId: 'user_123' });
    expect(syncUserUpdateMemberManyQueue.add).toHaveBeenCalledWith({ userId: 'user_123' });
  });

  it('delegates consumer synchronization to the consumer module', async () => {
    let { syncUserUpdateConsumerManyQueueProcessor } =
      await import('../src/queues/syncUserUpdateToConsumers');
    let { syncUserToConsumers } = await import('@metorial/module-consumer');

    await syncUserUpdateConsumerManyQueueProcessor({ userId: 'user_123' });

    expect(syncUserToConsumers).toHaveBeenCalledWith({ userId: 'user_123' });
  });

  it('updates the organization actor without triggering the legacy member consumer sync', async () => {
    let { db } = await import('@metorial/db');
    let { Fabric } = await import('@metorial/fabric');
    let { syncUserUpdateMemberQueueProcessor } =
      await import('../src/queues/syncUserUpdateToMembers');

    db.user.findUnique.mockResolvedValue({
      id: 'user_123',
      name: 'Updated User',
      email: 'updated@example.com',
      image: { type: 'default' },
      type: 'user'
    });
    db.organizationMember.findUnique.mockResolvedValue({
      id: 'ome_123',
      organization: { id: 'org_123' },
      actor: { id: 'oac_123' }
    });
    db.organizationMember.update.mockResolvedValue({ id: 'ome_123' });
    db.organizationActor.update.mockResolvedValue({ id: 'oac_123' });

    await syncUserUpdateMemberQueueProcessor({ userId: 'user_123', memberId: 'ome_123' });

    expect(db.organizationActor.update).toHaveBeenCalledWith({
      where: { id: 'oac_123' },
      data: {
        name: 'Updated User',
        image: { type: 'default' },
        email: 'updated@example.com'
      },
      include: {
        organization: true,
        member: true,
        teams: { include: { team: true } }
      }
    });
    expect(Fabric.fire).toHaveBeenCalledWith(
      'organization.member.updated:after',
      expect.any(Object)
    );
  });
});
