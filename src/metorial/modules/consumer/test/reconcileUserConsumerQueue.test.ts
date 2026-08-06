import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  let model = () => ({
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn()
  });

  return {
    user: { findUnique: vi.fn() },
    consumer: model(),
    instanceConsumer: model(),
    consumerProfile: model(),
    consumerInvite: model(),
    consumerActor: model(),
    consumerToken: model(),
    consumerIntegration: model(),
    consumerIntegrationEndpoint: model(),
    consumerIntegrationSession: model(),
    consumerSkill: model(),
    workspaceInvite: model(),
    workspaceProfile: model(),
    resourceActor: model(),
    skill: model(),
    fire: vi.fn(),
    consumerUpdatedAdd: vi.fn()
  };
});

vi.mock('@metorial/db', () => ({
  db: mocks,
  withTransaction: vi.fn(async callback => await callback(mocks))
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: mocks.fire }
}));

vi.mock('@metorial/lock', () => ({
  createLock: vi.fn(() => ({
    usingLock: vi.fn(async (_key, callback) => await callback())
  }))
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(config => ({
    name: config.name,
    add: vi.fn(),
    addManyWithOps: vi.fn(),
    process: vi.fn(handler => handler)
  })),
  QueueRetryError: class QueueRetryError extends Error {}
}));

vi.mock('../src/queues/lifecycle/consumer', () => ({
  consumerUpdatedQueue: { add: mocks.consumerUpdatedAdd }
}));

import { reconcileUserConsumerQueueProcessor } from '../src/queues/reconcileUserConsumer';

describe('reconcile user consumer queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merges duplicate consumer roots and emits set/delete lifecycle events', async () => {
    let user = {
      id: 'user_123',
      oid: 42n,
      type: 'user',
      name: 'Current Name',
      email: 'current@example.com',
      globalProfileOid: 100n
    };
    let canonical = {
      id: 'consumer_canonical',
      oid: 1n,
      userOid: user.oid,
      name: 'Old Name',
      email: 'old@example.com',
      globalProfileOid: null,
      organizationMemberOid: null,
      organizationActorOid: null,
      organizationMember: null,
      isOrganizationMember: false,
      isPortalConsumer: true,
      isManuallyCreated: false,
      isPending: false,
      createdAt: new Date('2026-01-01T00:00:00Z')
    };
    let duplicate = {
      ...canonical,
      id: 'consumer_duplicate',
      oid: 2n,
      userOid: null,
      email: user.email,
      isOrganizationMember: true,
      createdAt: new Date('2026-02-01T00:00:00Z')
    };

    mocks.user.findUnique.mockResolvedValue(user);
    mocks.consumer.findMany.mockResolvedValue([canonical, duplicate]);
    mocks.instanceConsumer.findMany.mockResolvedValue([]);
    mocks.consumerProfile.findMany.mockResolvedValue([]);
    mocks.consumerInvite.findMany.mockResolvedValue([]);
    mocks.consumer.update.mockResolvedValue({
      ...canonical,
      name: user.name,
      email: user.email
    });

    await (reconcileUserConsumerQueueProcessor as any)({
      userId: user.id,
      organizationId: 'organization_123'
    });

    expect(mocks.consumerProfile.updateMany).toHaveBeenCalledWith({
      where: { consumerOid: duplicate.oid },
      data: { consumerOid: canonical.oid }
    });
    expect(mocks.consumer.delete).toHaveBeenCalledWith({
      where: { oid: duplicate.oid }
    });
    expect(mocks.consumer.update).toHaveBeenCalledWith({
      where: { oid: canonical.oid },
      data: expect.objectContaining({
        userOid: user.oid,
        name: user.name,
        email: user.email,
        isOrganizationMember: true,
        isPortalConsumer: true
      })
    });
    expect(mocks.fire).toHaveBeenCalledWith('consumer.deleted:after', {
      consumerId: duplicate.id
    });
    expect(mocks.consumerUpdatedAdd).toHaveBeenCalledWith({
      consumerId: canonical.id
    });
  });

  it('treats a differently cased consumer email as the same identity', async () => {
    let user = {
      id: 'user_123',
      oid: 42n,
      type: 'user',
      name: 'Testing Testing',
      email: 'vgbmzap@herber.space',
      globalProfileOid: null
    };
    let invited = {
      id: 'consumer_invited',
      oid: 1n,
      userOid: null,
      name: 'Test',
      email: 'VgBmzap@herber.space',
      globalProfileOid: null,
      organizationMemberOid: null,
      organizationActorOid: null,
      organizationMember: null,
      isOrganizationMember: false,
      isPortalConsumer: true,
      isManuallyCreated: false,
      isPending: true,
      createdAt: new Date('2026-08-06T06:46:11Z')
    };

    mocks.user.findUnique.mockResolvedValue(user);
    mocks.consumer.findMany.mockResolvedValue([invited]);
    mocks.consumerProfile.findMany.mockResolvedValue([]);
    mocks.consumerInvite.findMany.mockResolvedValue([]);
    mocks.consumer.update.mockResolvedValue(invited);

    await (reconcileUserConsumerQueueProcessor as any)({
      userId: user.id,
      organizationId: 'organization_123'
    });

    expect(mocks.consumer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { email: { equals: user.email, mode: 'insensitive' }, userOid: null }
          ])
        })
      })
    );
    expect(mocks.consumer.delete).not.toHaveBeenCalled();
    expect(mocks.consumer.update).toHaveBeenCalledWith({
      where: { oid: invited.oid },
      data: expect.objectContaining({
        userOid: user.oid,
        email: user.email
      })
    });
  });

  it('collapses same-surface invites before moving a duplicate consumer', async () => {
    let user = {
      id: 'user_123',
      oid: 42n,
      type: 'user',
      name: 'Current Name',
      email: 'current@example.com',
      globalProfileOid: null
    };
    let canonical = {
      id: 'consumer_canonical',
      oid: 1n,
      userOid: user.oid,
      email: 'old@example.com',
      globalProfileOid: null,
      organizationMemberOid: null,
      organizationActorOid: null,
      organizationMember: null,
      isOrganizationMember: false,
      isPortalConsumer: false,
      isManuallyCreated: false,
      isPending: false,
      createdAt: new Date('2026-01-01T00:00:00Z')
    };
    let duplicate = {
      ...canonical,
      id: 'consumer_duplicate',
      oid: 2n,
      userOid: null,
      email: user.email,
      createdAt: new Date('2026-02-01T00:00:00Z')
    };
    let canonicalInvite = {
      id: 'invite_canonical',
      oid: 10n,
      surfaceOid: 30n,
      status: 'pending',
      acceptedAt: null,
      message: null,
      expiresAt: new Date('2026-08-10T00:00:00Z'),
      workspaceInvite: { oid: 40n }
    };
    let duplicateInvite = {
      id: 'invite_duplicate',
      oid: 11n,
      surfaceOid: 30n,
      status: 'accepted',
      acceptedAt: new Date('2026-08-01T00:00:00Z'),
      message: 'Welcome',
      expiresAt: new Date('2026-08-20T00:00:00Z'),
      workspaceInvite: { oid: 41n }
    };

    mocks.user.findUnique.mockResolvedValue(user);
    mocks.consumer.findMany.mockResolvedValue([canonical, duplicate]);
    mocks.instanceConsumer.findMany.mockResolvedValue([]);
    mocks.consumerProfile.findMany.mockResolvedValue([]);
    mocks.consumerInvite.findMany
      .mockResolvedValueOnce([duplicateInvite])
      .mockResolvedValueOnce([
        {
          ...canonicalInvite,
          consumerProfile: { id: 'profile_canonical' },
          invitedBy: { id: 'actor_1' },
          surface: { id: 'surface_1' }
        }
      ]);
    mocks.consumerInvite.findFirst.mockResolvedValue(canonicalInvite);
    mocks.consumer.update.mockResolvedValue(canonical);

    await (reconcileUserConsumerQueueProcessor as any)({
      userId: user.id,
      organizationId: 'organization_123'
    });

    expect(mocks.consumerInvite.update).toHaveBeenCalledWith({
      where: { oid: canonicalInvite.oid },
      data: {
        status: 'accepted',
        acceptedAt: duplicateInvite.acceptedAt,
        message: duplicateInvite.message,
        expiresAt: duplicateInvite.expiresAt
      }
    });
    expect(mocks.workspaceInvite.update).toHaveBeenCalledWith({
      where: { oid: duplicateInvite.workspaceInvite.oid },
      data: { consumerInviteOid: null }
    });
    expect(mocks.consumerInvite.delete).toHaveBeenCalledWith({
      where: { oid: duplicateInvite.oid }
    });
    expect(mocks.fire).toHaveBeenCalledWith(
      'consumer.invite.updated:after',
      expect.objectContaining({
        consumerInvite: expect.objectContaining({ id: canonicalInvite.id })
      })
    );
  });
});
