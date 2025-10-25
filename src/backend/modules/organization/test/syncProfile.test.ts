import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueueRetryError } from '@metorial/queue';

// Mock external dependencies
vi.mock('@metorial/db', () => ({
  db: {
    organization: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock('@metorial/module-community', () => ({
  profileService: {
    syncProfile: vi.fn()
  }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn().mockImplementation(config => ({
    name: config.name,
    process: vi.fn(handler => {
      return { handler };
    })
  })),
  QueueRetryError: class QueueRetryError extends Error {
    constructor(message?: string) {
      super(message);
      this.name = 'QueueRetryError';
    }
  }
}));

import { db } from '@metorial/db';
import { profileService } from '@metorial/module-community';
import { syncProfileQueue, syncProfileQueueProcessor } from '../src/queues/syncProfile';

describe('SyncProfile Queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('syncProfileQueue', () => {
    it('should create queue with correct name', () => {
      expect(syncProfileQueue).toBeDefined();
      expect(syncProfileQueue.name).toBe('org/sncProf');
    });

    it('should have process method', () => {
      expect(syncProfileQueue.process).toBeDefined();
      expect(typeof syncProfileQueue.process).toBe('function');
    });
  });

  describe('syncProfileQueueProcessor', () => {
    it('should process organization profile sync successfully', async () => {
      let mockOrg = {
        id: 'org-1',
        name: 'Test Org',
        slug: 'test-org',
        oid: 1
      };

      vi.mocked(db.organization.findUnique).mockResolvedValue(mockOrg as any);
      vi.mocked(profileService.syncProfile).mockResolvedValue(undefined);

      let data = { organizationId: 'org-1' };
      await (syncProfileQueueProcessor as any).handler(data);

      expect(db.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'org-1' }
      });

      expect(profileService.syncProfile).toHaveBeenCalledWith({
        for: {
          type: 'organization',
          organization: mockOrg
        }
      });
    });

    it('should throw QueueRetryError when organization not found', async () => {
      vi.mocked(db.organization.findUnique).mockResolvedValue(null);

      let data = { organizationId: 'org-999' };

      await expect((syncProfileQueueProcessor as any).handler(data)).rejects.toThrow(QueueRetryError);

      expect(db.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'org-999' }
      });
      expect(profileService.syncProfile).not.toHaveBeenCalled();
    });

    it('should handle organization with all properties', async () => {
      let mockOrg = {
        id: 'org-2',
        name: 'Complex Org',
        slug: 'complex-org',
        oid: 2,
        status: 'active',
        type: 'default',
        image: { type: 'default' },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(db.organization.findUnique).mockResolvedValue(mockOrg as any);
      vi.mocked(profileService.syncProfile).mockResolvedValue(undefined);

      let data = { organizationId: 'org-2' };
      await (syncProfileQueueProcessor as any).handler(data);

      expect(profileService.syncProfile).toHaveBeenCalledWith({
        for: {
          type: 'organization',
          organization: mockOrg
        }
      });
    });

    it('should handle profileService errors', async () => {
      let mockOrg = {
        id: 'org-3',
        name: 'Error Org',
        slug: 'error-org',
        oid: 3
      };

      vi.mocked(db.organization.findUnique).mockResolvedValue(mockOrg as any);
      vi.mocked(profileService.syncProfile).mockRejectedValue(
        new Error('Profile sync failed')
      );

      let data = { organizationId: 'org-3' };

      await expect((syncProfileQueueProcessor as any).handler(data)).rejects.toThrow(
        'Profile sync failed'
      );

      expect(db.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'org-3' }
      });
    });

    it('should handle empty organization ID', async () => {
      vi.mocked(db.organization.findUnique).mockResolvedValue(null);

      let data = { organizationId: '' };

      await expect((syncProfileQueueProcessor as any).handler(data)).rejects.toThrow(QueueRetryError);
    });

    it('should handle database errors', async () => {
      vi.mocked(db.organization.findUnique).mockRejectedValue(
        new Error('Database connection failed')
      );

      let data = { organizationId: 'org-4' };

      await expect((syncProfileQueueProcessor as any).handler(data)).rejects.toThrow(
        'Database connection failed'
      );

      expect(profileService.syncProfile).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle null organization ID', async () => {
      vi.mocked(db.organization.findUnique).mockResolvedValue(null);

      let data = { organizationId: null as any };

      await expect((syncProfileQueueProcessor as any).handler(data)).rejects.toThrow();
    });

    it('should handle undefined organization ID', async () => {
      vi.mocked(db.organization.findUnique).mockResolvedValue(null);

      let data = { organizationId: undefined as any };

      await expect((syncProfileQueueProcessor as any).handler(data)).rejects.toThrow();
    });

    it('should process multiple organizations sequentially', async () => {
      let mockOrg1 = { id: 'org-1', name: 'Org 1', slug: 'org-1', oid: 1 };
      let mockOrg2 = { id: 'org-2', name: 'Org 2', slug: 'org-2', oid: 2 };

      vi.mocked(db.organization.findUnique)
        .mockResolvedValueOnce(mockOrg1 as any)
        .mockResolvedValueOnce(mockOrg2 as any);

      vi.mocked(profileService.syncProfile).mockResolvedValue(undefined);

      await (syncProfileQueueProcessor as any).handler({ organizationId: 'org-1' });
      await (syncProfileQueueProcessor as any).handler({ organizationId: 'org-2' });

      expect(db.organization.findUnique).toHaveBeenCalledTimes(2);
      expect(profileService.syncProfile).toHaveBeenCalledTimes(2);
    });
  });
});
