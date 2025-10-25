import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing
vi.mock('@metorial/db', () => ({
  db: {
    user: {
      findUnique: vi.fn()
    },
    organizationMember: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    organizationActor: {
      update: vi.fn()
    }
  }
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    fire: vi.fn()
  }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn((config) => ({
    name: config.name,
    add: vi.fn(),
    addMany: vi.fn(),
    process: vi.fn((handler) => handler)
  })),
  QueueRetryError: class QueueRetryError extends Error {
    constructor(message?: string) {
      super(message || 'Queue retry error');
      this.name = 'QueueRetryError';
    }
  }
}));

describe('syncUserUpdate queues', () => {
  let db: any;
  let Fabric: any;
  let QueueRetryError: any;
  let syncUserUpdateQueue: any;
  let syncUserUpdateSingleQueue: any;
  let syncUserUpdateQueueProcessor: any;
  let syncUserUpdateSingleQueueProcessor: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const dbModule = await import('@metorial/db');
    db = dbModule.db;

    const fabricModule = await import('@metorial/fabric');
    Fabric = fabricModule.Fabric;

    const queueModule = await import('@metorial/queue');
    QueueRetryError = queueModule.QueueRetryError;

    // Re-import the module to get fresh queue instances
    vi.resetModules();
    const syncModule = await import('../src/queues/syncUserUpdate');
    syncUserUpdateQueue = syncModule.syncUserUpdateQueue;
    syncUserUpdateSingleQueue = syncModule.syncUserUpdateSingleQueue;
    syncUserUpdateQueueProcessor = syncModule.syncUserUpdateQueueProcessor;
    syncUserUpdateSingleQueueProcessor = syncModule.syncUserUpdateSingleQueueProcessor;
  });

  describe('syncUserUpdateQueueProcessor', () => {
    it('should process user update and add jobs for each member', async () => {
      const mockUser = {
        id: 'user_123',
        name: 'Test User',
        email: 'test@example.com',
        image: { type: 'default' },
        members: [
          { id: 'member_1', organization: { id: 'org_1' } },
          { id: 'member_2', organization: { id: 'org_2' } },
          { id: 'member_3', organization: { id: 'org_3' } }
        ]
      };

      db.user.findUnique.mockResolvedValue(mockUser);
      syncUserUpdateSingleQueue.addMany = vi.fn();

      await syncUserUpdateQueueProcessor({ userId: 'user_123' });

      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user_123' },
        include: {
          members: { include: { organization: true } }
        }
      });

      expect(syncUserUpdateSingleQueue.addMany).toHaveBeenCalledWith([
        { userId: 'user_123', memberId: 'member_1' },
        { userId: 'user_123', memberId: 'member_2' },
        { userId: 'user_123', memberId: 'member_3' }
      ]);
    });

    it('should throw QueueRetryError if user not found', async () => {
      db.user.findUnique.mockResolvedValue(null);

      await expect(
        syncUserUpdateQueueProcessor({ userId: 'user_nonexistent' })
      ).rejects.toThrow(QueueRetryError);
    });

    it('should handle user with no members', async () => {
      const mockUser = {
        id: 'user_123',
        name: 'Test User',
        email: 'test@example.com',
        members: []
      };

      db.user.findUnique.mockResolvedValue(mockUser);
      syncUserUpdateSingleQueue.addMany = vi.fn();

      await syncUserUpdateQueueProcessor({ userId: 'user_123' });

      expect(syncUserUpdateSingleQueue.addMany).toHaveBeenCalledWith([]);
    });

    it('should handle user with single member', async () => {
      const mockUser = {
        id: 'user_123',
        name: 'Test User',
        members: [
          { id: 'member_1', organization: { id: 'org_1' } }
        ]
      };

      db.user.findUnique.mockResolvedValue(mockUser);
      syncUserUpdateSingleQueue.addMany = vi.fn();

      await syncUserUpdateQueueProcessor({ userId: 'user_123' });

      expect(syncUserUpdateSingleQueue.addMany).toHaveBeenCalledWith([
        { userId: 'user_123', memberId: 'member_1' }
      ]);
    });
  });

  describe('syncUserUpdateSingleQueueProcessor', () => {
    it('should update member and actor successfully', async () => {
      const mockUser = {
        id: 'user_123',
        name: 'Updated User',
        email: 'updated@example.com',
        image: { type: 'url', url: 'https://example.com/avatar.jpg' }
      };

      const mockMember = {
        id: 'member_1',
        organization: { id: 'org_1', name: 'Test Org' },
        actor: {
          id: 'actor_1',
          name: 'Old Name',
          email: 'old@example.com'
        }
      };

      const mockUpdatedMember = { ...mockMember };
      const mockUpdatedActor = {
        ...mockMember.actor,
        name: mockUser.name,
        email: mockUser.email,
        image: mockUser.image
      };

      db.user.findUnique.mockResolvedValue(mockUser);
      db.organizationMember.findUnique.mockResolvedValue(mockMember);
      db.organizationMember.update.mockResolvedValue(mockUpdatedMember);
      db.organizationActor.update.mockResolvedValue(mockUpdatedActor);

      await syncUserUpdateSingleQueueProcessor({
        userId: 'user_123',
        memberId: 'member_1'
      });

      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user_123' }
      });

      expect(db.organizationMember.findUnique).toHaveBeenCalledWith({
        where: { id: 'member_1' },
        include: {
          organization: true,
          actor: true
        }
      });

      expect(db.organizationActor.update).toHaveBeenCalledWith({
        where: { id: 'actor_1' },
        data: {
          name: 'Updated User',
          image: mockUser.image,
          email: 'updated@example.com'
        }
      });
    });

    it('should throw QueueRetryError if user not found', async () => {
      db.user.findUnique.mockResolvedValue(null);

      await expect(
        syncUserUpdateSingleQueueProcessor({
          userId: 'user_nonexistent',
          memberId: 'member_1'
        })
      ).rejects.toThrow(QueueRetryError);
    });

    it('should throw QueueRetryError if member not found', async () => {
      const mockUser = {
        id: 'user_123',
        name: 'Test User'
      };

      db.user.findUnique.mockResolvedValue(mockUser);
      db.organizationMember.findUnique.mockResolvedValue(null);

      await expect(
        syncUserUpdateSingleQueueProcessor({
          userId: 'user_123',
          memberId: 'member_nonexistent'
        })
      ).rejects.toThrow(QueueRetryError);
    });

    it('should fire Fabric events in correct order', async () => {
      const mockUser = {
        id: 'user_123',
        name: 'Test User',
        email: 'test@example.com',
        image: { type: 'default' }
      };

      const mockMember = {
        id: 'member_1',
        organization: { id: 'org_1' },
        actor: { id: 'actor_1', name: 'Old Name' }
      };

      db.user.findUnique.mockResolvedValue(mockUser);
      db.organizationMember.findUnique.mockResolvedValue(mockMember);
      db.organizationMember.update.mockResolvedValue(mockMember);
      db.organizationActor.update.mockResolvedValue(mockMember.actor);

      await syncUserUpdateSingleQueueProcessor({
        userId: 'user_123',
        memberId: 'member_1'
      });

      const calls = Fabric.fire.mock.calls;
      expect(calls[0][0]).toBe('organization.member.updated:before');
      expect(calls[1][0]).toBe('organization.actor.updated:before');
      expect(calls[2][0]).toBe('organization.actor.updated:after');
      expect(calls[3][0]).toBe('organization.member.updated:after');
    });

    it('should pass correct data to Fabric events', async () => {
      const mockUser = {
        id: 'user_123',
        name: 'Test User',
        email: 'test@example.com',
        image: { type: 'default' }
      };

      const mockMember = {
        id: 'member_1',
        organization: { id: 'org_1', name: 'Test Org' },
        actor: { id: 'actor_1', name: 'Old Name' }
      };

      const mockUpdatedActor = {
        ...mockMember.actor,
        name: mockUser.name
      };

      db.user.findUnique.mockResolvedValue(mockUser);
      db.organizationMember.findUnique.mockResolvedValue(mockMember);
      db.organizationMember.update.mockResolvedValue(mockMember);
      db.organizationActor.update.mockResolvedValue(mockUpdatedActor);

      await syncUserUpdateSingleQueueProcessor({
        userId: 'user_123',
        memberId: 'member_1'
      });

      expect(Fabric.fire).toHaveBeenCalledWith('organization.member.updated:before', {
        member: mockMember,
        organization: mockMember.organization,
        performedBy: mockMember.actor
      });

      expect(Fabric.fire).toHaveBeenCalledWith('organization.actor.updated:after', {
        actor: mockUpdatedActor,
        organization: mockMember.organization,
        performedBy: mockMember.actor
      });
    });

    it('should update organizationMember with empty data', async () => {
      const mockUser = {
        id: 'user_123',
        name: 'Test User',
        email: 'test@example.com',
        image: { type: 'default' }
      };

      const mockMember = {
        id: 'member_1',
        organization: { id: 'org_1' },
        actor: { id: 'actor_1' }
      };

      db.user.findUnique.mockResolvedValue(mockUser);
      db.organizationMember.findUnique.mockResolvedValue(mockMember);
      db.organizationMember.update.mockResolvedValue(mockMember);
      db.organizationActor.update.mockResolvedValue(mockMember.actor);

      await syncUserUpdateSingleQueueProcessor({
        userId: 'user_123',
        memberId: 'member_1'
      });

      expect(db.organizationMember.update).toHaveBeenCalledWith({
        where: { id: 'member_1' },
        data: {}
      });
    });
  });

  describe('edge cases', () => {
    it('should handle user with many members', async () => {
      const members = Array.from({ length: 100 }, (_, i) => ({
        id: `member_${i}`,
        organization: { id: `org_${i}` }
      }));

      const mockUser = {
        id: 'user_123',
        name: 'Test User',
        members
      };

      db.user.findUnique.mockResolvedValue(mockUser);
      syncUserUpdateSingleQueue.addMany = vi.fn();

      await syncUserUpdateQueueProcessor({ userId: 'user_123' });

      expect(syncUserUpdateSingleQueue.addMany).toHaveBeenCalledWith(
        members.map(m => ({
          userId: 'user_123',
          memberId: m.id
        }))
      );
    });

    it('should handle null image in user data', async () => {
      const mockUser = {
        id: 'user_123',
        name: 'Test User',
        email: 'test@example.com',
        image: null
      };

      const mockMember = {
        id: 'member_1',
        organization: { id: 'org_1' },
        actor: { id: 'actor_1' }
      };

      db.user.findUnique.mockResolvedValue(mockUser);
      db.organizationMember.findUnique.mockResolvedValue(mockMember);
      db.organizationMember.update.mockResolvedValue(mockMember);
      db.organizationActor.update.mockResolvedValue(mockMember.actor);

      await syncUserUpdateSingleQueueProcessor({
        userId: 'user_123',
        memberId: 'member_1'
      });

      expect(db.organizationActor.update).toHaveBeenCalledWith({
        where: { id: 'actor_1' },
        data: {
          name: 'Test User',
          image: null,
          email: 'test@example.com'
        }
      });
    });

    it('should handle special characters in user name and email', async () => {
      const mockUser = {
        id: 'user_123',
        name: 'Test User (Admin) <admin@test>',
        email: 'test+special@example.com',
        image: { type: 'default' }
      };

      const mockMember = {
        id: 'member_1',
        organization: { id: 'org_1' },
        actor: { id: 'actor_1' }
      };

      db.user.findUnique.mockResolvedValue(mockUser);
      db.organizationMember.findUnique.mockResolvedValue(mockMember);
      db.organizationMember.update.mockResolvedValue(mockMember);
      db.organizationActor.update.mockResolvedValue(mockMember.actor);

      await syncUserUpdateSingleQueueProcessor({
        userId: 'user_123',
        memberId: 'member_1'
      });

      expect(db.organizationActor.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Test User (Admin) <admin@test>',
            email: 'test+special@example.com'
          })
        })
      );
    });

    it('should handle concurrent processing of same user', async () => {
      const mockUser = {
        id: 'user_123',
        name: 'Test User',
        email: 'test@example.com',
        image: { type: 'default' }
      };

      const mockMembers = [
        { id: 'member_1', organization: { id: 'org_1' }, actor: { id: 'actor_1' } },
        { id: 'member_2', organization: { id: 'org_2' }, actor: { id: 'actor_2' } }
      ];

      db.user.findUnique.mockResolvedValue(mockUser);
      db.organizationMember.findUnique.mockImplementation(({ where }) => {
        const member = mockMembers.find(m => m.id === where.id);
        return Promise.resolve(member || null);
      });
      db.organizationMember.update.mockResolvedValue({});
      db.organizationActor.update.mockResolvedValue({});

      await Promise.all([
        syncUserUpdateSingleQueueProcessor({
          userId: 'user_123',
          memberId: 'member_1'
        }),
        syncUserUpdateSingleQueueProcessor({
          userId: 'user_123',
          memberId: 'member_2'
        })
      ]);

      expect(db.organizationActor.update).toHaveBeenCalledTimes(2);
    });

    it('should handle empty string values in user data', async () => {
      const mockUser = {
        id: 'user_123',
        name: '',
        email: '',
        image: { type: 'default' }
      };

      const mockMember = {
        id: 'member_1',
        organization: { id: 'org_1' },
        actor: { id: 'actor_1' }
      };

      db.user.findUnique.mockResolvedValue(mockUser);
      db.organizationMember.findUnique.mockResolvedValue(mockMember);
      db.organizationMember.update.mockResolvedValue(mockMember);
      db.organizationActor.update.mockResolvedValue(mockMember.actor);

      await syncUserUpdateSingleQueueProcessor({
        userId: 'user_123',
        memberId: 'member_1'
      });

      expect(db.organizationActor.update).toHaveBeenCalledWith({
        where: { id: 'actor_1' },
        data: {
          name: '',
          image: mockUser.image,
          email: ''
        }
      });
    });
  });
});
