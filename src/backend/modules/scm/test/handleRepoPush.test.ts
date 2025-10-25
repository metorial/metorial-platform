// @ts-nocheck - Test file with mocked types
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueueRetryError } from '@metorial/queue';

// Mock external dependencies
vi.mock('@metorial/db', () => ({
  db: {
    scmRepoPush: {
      findUnique: vi.fn()
    },
    customServer: {
      findMany: vi.fn(),
      findFirst: vi.fn()
    }
  }
}));

vi.mock('@metorial/config', () => ({
  getConfig: vi.fn(() => ({
    redisUrl: 'redis://localhost:6379'
  }))
}));

vi.mock('@metorial/module-custom-server', () => ({
  customServerVersionService: {
    createVersion: vi.fn()
  }
}));

vi.mock('@metorial/module-organization', () => ({
  organizationActorService: {
    getSystemActor: vi.fn()
  }
}));

// Mock queue creation to avoid Redis connection
vi.mock('@metorial/queue', () => {
  return {
    QueueRetryError: class QueueRetryError extends Error {},
    createQueue: vi.fn(() => ({
      process: vi.fn((fn) => {
        return { handler: fn };
      }),
      add: vi.fn(),
      addMany: vi.fn()
    }))
  };
});

import { db } from '@metorial/db';
import { customServerVersionService } from '@metorial/module-custom-server';
import { organizationActorService } from '@metorial/module-organization';
import {
  createHandleRepoPushQueue,
  createHandleRepoPushQueueProcessor,
  createHandleRepoPushForCustomServerQueue,
  createHandleRepoPushForCustomServerQueueProcessor
} from '../src/queue/handleRepoPush';

describe('handleRepoPush Queue Processors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createHandleRepoPushQueueProcessor', () => {
    it('should find custom servers and queue push handlers', async () => {
      const mockPush = {
        id: 'push-1',
        repo: {
          oid: 'repo-oid-1',
          id: 'scm-repo-1'
        }
      };

      const mockCustomServers = [
        { id: 'cs-1', repositoryOid: 'repo-oid-1' },
        { id: 'cs-2', repositoryOid: 'repo-oid-1' }
      ];

      vi.mocked(db.scmRepoPush.findUnique).mockResolvedValue(mockPush as any);
      vi.mocked(db.customServer.findMany).mockResolvedValue(mockCustomServers as any);

      const addManySpy = vi.spyOn(createHandleRepoPushForCustomServerQueue, 'addMany');

      await createHandleRepoPushQueueProcessor.handler({ pushId: 'push-1' });

      expect(db.scmRepoPush.findUnique).toHaveBeenCalledWith({
        where: { id: 'push-1' },
        include: { repo: true }
      });

      expect(db.customServer.findMany).toHaveBeenCalledWith({
        where: { repositoryOid: 'repo-oid-1' }
      });

      expect(addManySpy).toHaveBeenCalledWith([
        { pushId: 'push-1', customServerId: 'cs-1' },
        { pushId: 'push-1', customServerId: 'cs-2' }
      ]);
    });

    it('should throw QueueRetryError when push not found', async () => {
      vi.mocked(db.scmRepoPush.findUnique).mockResolvedValue(null);

      await expect(
        createHandleRepoPushQueueProcessor.handler({ pushId: 'non-existent' })
      ).rejects.toThrow(QueueRetryError);
    });

    it('should handle push with no custom servers', async () => {
      const mockPush = {
        id: 'push-1',
        repo: {
          oid: 'repo-oid-1',
          id: 'scm-repo-1'
        }
      };

      vi.mocked(db.scmRepoPush.findUnique).mockResolvedValue(mockPush as any);
      vi.mocked(db.customServer.findMany).mockResolvedValue([]);

      const addManySpy = vi.spyOn(createHandleRepoPushForCustomServerQueue, 'addMany');

      await createHandleRepoPushQueueProcessor.handler({ pushId: 'push-1' });

      expect(addManySpy).toHaveBeenCalledWith([]);
    });

    it('should handle multiple custom servers', async () => {
      const mockPush = {
        id: 'push-1',
        repo: {
          oid: 'repo-oid-1'
        }
      };

      const mockCustomServers = Array.from({ length: 5 }, (_, i) => ({
        id: `cs-${i}`,
        repositoryOid: 'repo-oid-1'
      }));

      vi.mocked(db.scmRepoPush.findUnique).mockResolvedValue(mockPush as any);
      vi.mocked(db.customServer.findMany).mockResolvedValue(mockCustomServers as any);

      const addManySpy = vi.spyOn(createHandleRepoPushForCustomServerQueue, 'addMany');

      await createHandleRepoPushQueueProcessor.handler({ pushId: 'push-1' });

      expect(addManySpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          { pushId: 'push-1', customServerId: 'cs-0' },
          { pushId: 'push-1', customServerId: 'cs-1' },
          { pushId: 'push-1', customServerId: 'cs-2' },
          { pushId: 'push-1', customServerId: 'cs-3' },
          { pushId: 'push-1', customServerId: 'cs-4' }
        ])
      );
    });
  });

  describe('createHandleRepoPushForCustomServerQueueProcessor', () => {
    it('should create version for custom server', async () => {
      const mockPush = {
        id: 'push-1',
        repo: {
          oid: 'repo-oid-1'
        },
        sha: 'abc123',
        branchName: 'main'
      };

      const mockCustomServer = {
        id: 'cs-1',
        repositoryOid: 'repo-oid-1',
        instance: {
          id: 'inst-1',
          organization: {
            id: 'org-1',
            oid: 'org-oid-1'
          }
        }
      };

      const mockSystemActor = {
        id: 'system-actor-1',
        oid: 'system-actor-oid-1'
      };

      vi.mocked(db.scmRepoPush.findUnique).mockResolvedValue(mockPush as any);
      vi.mocked(db.customServer.findFirst).mockResolvedValue(mockCustomServer as any);
      vi.mocked(organizationActorService.getSystemActor).mockResolvedValue(mockSystemActor as any);
      vi.mocked(customServerVersionService.createVersion).mockResolvedValue({} as any);

      await createHandleRepoPushForCustomServerQueueProcessor.handler({
        pushId: 'push-1',
        customServerId: 'cs-1'
      });

      expect(db.scmRepoPush.findUnique).toHaveBeenCalledWith({
        where: { id: 'push-1' },
        include: { repo: true }
      });

      expect(db.customServer.findFirst).toHaveBeenCalledWith({
        where: { id: 'cs-1' },
        include: {
          instance: {
            include: {
              organization: true
            }
          }
        }
      });

      expect(organizationActorService.getSystemActor).toHaveBeenCalledWith({
        organization: mockCustomServer.instance.organization
      });

      expect(customServerVersionService.createVersion).toHaveBeenCalledWith({
        server: mockCustomServer,
        instance: mockCustomServer.instance,
        organization: mockCustomServer.instance.organization,
        performedBy: mockSystemActor,
        push: mockPush,
        serverInstance: {
          type: 'managed',
          implementation: {}
        }
      });
    });

    it('should throw QueueRetryError when push not found', async () => {
      vi.mocked(db.scmRepoPush.findUnique).mockResolvedValue(null);
      vi.mocked(db.customServer.findFirst).mockResolvedValue({} as any);

      await expect(
        createHandleRepoPushForCustomServerQueueProcessor.handler({
          pushId: 'non-existent',
          customServerId: 'cs-1'
        })
      ).rejects.toThrow(QueueRetryError);
    });

    it('should throw QueueRetryError when custom server not found', async () => {
      const mockPush = {
        id: 'push-1',
        repo: { oid: 'repo-oid-1' }
      };

      vi.mocked(db.scmRepoPush.findUnique).mockResolvedValue(mockPush as any);
      vi.mocked(db.customServer.findFirst).mockResolvedValue(null);

      await expect(
        createHandleRepoPushForCustomServerQueueProcessor.handler({
          pushId: 'push-1',
          customServerId: 'non-existent'
        })
      ).rejects.toThrow(QueueRetryError);
    });

    it('should throw QueueRetryError when both push and server not found', async () => {
      vi.mocked(db.scmRepoPush.findUnique).mockResolvedValue(null);
      vi.mocked(db.customServer.findFirst).mockResolvedValue(null);

      await expect(
        createHandleRepoPushForCustomServerQueueProcessor.handler({
          pushId: 'non-existent',
          customServerId: 'non-existent'
        })
      ).rejects.toThrow(QueueRetryError);
    });

    it('should handle version creation with correct parameters', async () => {
      const mockPush = {
        id: 'push-1',
        repo: { oid: 'repo-oid-1' },
        sha: 'commit-sha-123',
        branchName: 'main',
        commitMessage: 'Test commit'
      };

      const mockCustomServer = {
        id: 'cs-1',
        name: 'test-server',
        instance: {
          id: 'inst-1',
          organization: {
            id: 'org-1',
            name: 'Test Org'
          }
        }
      };

      const mockSystemActor = {
        id: 'system-actor-1'
      };

      vi.mocked(db.scmRepoPush.findUnique).mockResolvedValue(mockPush as any);
      vi.mocked(db.customServer.findFirst).mockResolvedValue(mockCustomServer as any);
      vi.mocked(organizationActorService.getSystemActor).mockResolvedValue(mockSystemActor as any);
      vi.mocked(customServerVersionService.createVersion).mockResolvedValue({
        id: 'version-1'
      } as any);

      await createHandleRepoPushForCustomServerQueueProcessor.handler({
        pushId: 'push-1',
        customServerId: 'cs-1'
      });

      expect(customServerVersionService.createVersion).toHaveBeenCalledWith({
        server: mockCustomServer,
        instance: mockCustomServer.instance,
        organization: mockCustomServer.instance.organization,
        performedBy: mockSystemActor,
        push: mockPush,
        serverInstance: {
          type: 'managed',
          implementation: {}
        }
      });
    });

    it('should propagate errors from createVersion', async () => {
      const mockPush = {
        id: 'push-1',
        repo: { oid: 'repo-oid-1' }
      };

      const mockCustomServer = {
        id: 'cs-1',
        instance: {
          organization: { id: 'org-1' }
        }
      };

      vi.mocked(db.scmRepoPush.findUnique).mockResolvedValue(mockPush as any);
      vi.mocked(db.customServer.findFirst).mockResolvedValue(mockCustomServer as any);
      vi.mocked(organizationActorService.getSystemActor).mockResolvedValue({} as any);
      vi.mocked(customServerVersionService.createVersion).mockRejectedValue(
        new Error('Version creation failed')
      );

      await expect(
        createHandleRepoPushForCustomServerQueueProcessor.handler({
          pushId: 'push-1',
          customServerId: 'cs-1'
        })
      ).rejects.toThrow('Version creation failed');
    });
  });

  describe('Queue definitions', () => {
    it('should have valid queue definitions', () => {
      expect(createHandleRepoPushQueue).toBeDefined();
      expect(createHandleRepoPushQueue.add).toBeInstanceOf(Function);

      expect(createHandleRepoPushForCustomServerQueue).toBeDefined();
      expect(createHandleRepoPushForCustomServerQueue.add).toBeInstanceOf(Function);
      expect(createHandleRepoPushForCustomServerQueue.addMany).toBeInstanceOf(Function);
    });
  });
});
