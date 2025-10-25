import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueueRetryError } from '@metorial/queue';

// Mock dependencies
vi.mock('@metorial/db', () => ({
  db: {
    codeBucket: {
      findFirst: vi.fn()
    }
  }
}));

vi.mock('@metorial/module-code-bucket', () => ({
  codeBucketService: {
    syncCodeBuckets: vi.fn()
  }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn((config) => ({
    name: config.name,
    process: vi.fn((handler) => ({
      handler,
      processName: 'syncCurrentDraftBucketToRepo'
    }))
  })),
  QueueRetryError: class QueueRetryError extends Error {
    constructor() {
      super('Retry');
      this.name = 'QueueRetryError';
    }
  }
}));

import { db } from '@metorial/db';
import { codeBucketService } from '@metorial/module-code-bucket';
import { syncCurrentDraftBucketToRepoQueue, syncCurrentDraftBucketToRepoQueueProcessor } from '../src/queues/syncCurrentDraftBucketToRepo';

describe('syncCurrentDraftBucketToRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('queue configuration', () => {
    it('should create queue with correct name', () => {
      expect(syncCurrentDraftBucketToRepoQueue).toBeDefined();
      expect(syncCurrentDraftBucketToRepoQueue.name).toBe('csv/sncDrftBkRpo');
    });

    it('should export queue processor', () => {
      expect(syncCurrentDraftBucketToRepoQueueProcessor).toBeDefined();
    });
  });

  describe('queue processor', () => {
    const mockDraftBucket = {
      oid: BigInt(1),
      id: 'draft-123',
      path: '/path/to/draft'
    };

    const mockImmutableBucket = {
      oid: BigInt(2),
      id: 'immutable-123',
      path: '/path/to/immutable'
    };

    it('should sync buckets when both exist', async () => {
      (db.codeBucket.findFirst as any).mockImplementation(({ where }: any) => {
        if (where.oid === BigInt(1)) return Promise.resolve(mockDraftBucket);
        if (where.oid === BigInt(2)) return Promise.resolve(mockImmutableBucket);
        return Promise.resolve(null);
      });

      const handler = (syncCurrentDraftBucketToRepoQueueProcessor as any).handler;
      await handler({
        draftBucketOid: BigInt(1),
        immutableBucketOid: BigInt(2)
      });

      expect(db.codeBucket.findFirst).toHaveBeenCalledTimes(2);
      expect(db.codeBucket.findFirst).toHaveBeenCalledWith({
        where: { oid: BigInt(1) }
      });
      expect(db.codeBucket.findFirst).toHaveBeenCalledWith({
        where: { oid: BigInt(2) }
      });

      expect(codeBucketService.syncCodeBuckets).toHaveBeenCalledWith({
        source: mockImmutableBucket,
        target: mockDraftBucket
      });
    });

    it('should throw QueueRetryError when draft bucket not found', async () => {
      (db.codeBucket.findFirst as any).mockImplementation(({ where }: any) => {
        if (where.oid === BigInt(1)) return Promise.resolve(null); // Draft not found
        if (where.oid === BigInt(2)) return Promise.resolve(mockImmutableBucket);
        return Promise.resolve(null);
      });

      const handler = (syncCurrentDraftBucketToRepoQueueProcessor as any).handler;

      await expect(handler({
        draftBucketOid: BigInt(1),
        immutableBucketOid: BigInt(2)
      })).rejects.toThrow(QueueRetryError);

      expect(codeBucketService.syncCodeBuckets).not.toHaveBeenCalled();
    });

    it('should throw QueueRetryError when immutable bucket not found', async () => {
      (db.codeBucket.findFirst as any).mockImplementation(({ where }: any) => {
        if (where.oid === BigInt(1)) return Promise.resolve(mockDraftBucket);
        if (where.oid === BigInt(2)) return Promise.resolve(null); // Immutable not found
        return Promise.resolve(null);
      });

      const handler = (syncCurrentDraftBucketToRepoQueueProcessor as any).handler;

      await expect(handler({
        draftBucketOid: BigInt(1),
        immutableBucketOid: BigInt(2)
      })).rejects.toThrow(QueueRetryError);

      expect(codeBucketService.syncCodeBuckets).not.toHaveBeenCalled();
    });

    it('should throw QueueRetryError when both buckets not found', async () => {
      (db.codeBucket.findFirst as any).mockResolvedValue(null);

      const handler = (syncCurrentDraftBucketToRepoQueueProcessor as any).handler;

      await expect(handler({
        draftBucketOid: BigInt(1),
        immutableBucketOid: BigInt(2)
      })).rejects.toThrow(QueueRetryError);

      expect(codeBucketService.syncCodeBuckets).not.toHaveBeenCalled();
    });

    it('should query buckets in correct order', async () => {
      (db.codeBucket.findFirst as any).mockImplementation(({ where }: any) => {
        if (where.oid === BigInt(1)) return Promise.resolve(mockDraftBucket);
        if (where.oid === BigInt(2)) return Promise.resolve(mockImmutableBucket);
        return Promise.resolve(null);
      });

      const handler = (syncCurrentDraftBucketToRepoQueueProcessor as any).handler;
      await handler({
        draftBucketOid: BigInt(1),
        immutableBucketOid: BigInt(2)
      });

      const calls = (db.codeBucket.findFirst as any).mock.calls;
      expect(calls[0][0].where.oid).toBe(BigInt(1)); // Draft first
      expect(calls[1][0].where.oid).toBe(BigInt(2)); // Immutable second
    });

    it('should pass correct source and target to syncCodeBuckets', async () => {
      (db.codeBucket.findFirst as any).mockImplementation(({ where }: any) => {
        if (where.oid === BigInt(1)) return Promise.resolve(mockDraftBucket);
        if (where.oid === BigInt(2)) return Promise.resolve(mockImmutableBucket);
        return Promise.resolve(null);
      });

      const handler = (syncCurrentDraftBucketToRepoQueueProcessor as any).handler;
      await handler({
        draftBucketOid: BigInt(1),
        immutableBucketOid: BigInt(2)
      });

      expect(codeBucketService.syncCodeBuckets).toHaveBeenCalledWith({
        source: mockImmutableBucket, // Immutable is source
        target: mockDraftBucket // Draft is target
      });
    });

    it('should handle different bigint values', async () => {
      const largeBigInt1 = BigInt('9007199254740991');
      const largeBigInt2 = BigInt('9007199254740992');

      (db.codeBucket.findFirst as any).mockImplementation(({ where }: any) => {
        if (where.oid === largeBigInt1) return Promise.resolve({ ...mockDraftBucket, oid: largeBigInt1 });
        if (where.oid === largeBigInt2) return Promise.resolve({ ...mockImmutableBucket, oid: largeBigInt2 });
        return Promise.resolve(null);
      });

      const handler = (syncCurrentDraftBucketToRepoQueueProcessor as any).handler;
      await handler({
        draftBucketOid: largeBigInt1,
        immutableBucketOid: largeBigInt2
      });

      expect(codeBucketService.syncCodeBuckets).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should propagate errors from syncCodeBuckets', async () => {
      (db.codeBucket.findFirst as any).mockResolvedValue({ oid: BigInt(1) });
      (codeBucketService.syncCodeBuckets as any).mockRejectedValue(new Error('Sync failed'));

      const handler = (syncCurrentDraftBucketToRepoQueueProcessor as any).handler;

      await expect(handler({
        draftBucketOid: BigInt(1),
        immutableBucketOid: BigInt(2)
      })).rejects.toThrow('Sync failed');
    });

    it('should propagate errors from database queries', async () => {
      (db.codeBucket.findFirst as any).mockRejectedValue(new Error('Database error'));

      const handler = (syncCurrentDraftBucketToRepoQueueProcessor as any).handler;

      await expect(handler({
        draftBucketOid: BigInt(1),
        immutableBucketOid: BigInt(2)
      })).rejects.toThrow('Database error');
    });
  });

  describe('edge cases', () => {
    it('should handle buckets with same oid (edge case)', async () => {
      const sameBucket = {
        oid: BigInt(1),
        id: 'same-123',
        path: '/path/to/same'
      };

      (db.codeBucket.findFirst as any).mockResolvedValue(sameBucket);
      (codeBucketService.syncCodeBuckets as any).mockResolvedValue(undefined);

      const handler = (syncCurrentDraftBucketToRepoQueueProcessor as any).handler;
      await handler({
        draftBucketOid: BigInt(1),
        immutableBucketOid: BigInt(1)
      });

      expect(codeBucketService.syncCodeBuckets).toHaveBeenCalledWith({
        source: sameBucket,
        target: sameBucket
      });
    });

    it('should handle buckets with zero oid', async () => {
      const zeroBucket = {
        oid: BigInt(0),
        id: 'zero-123',
        path: '/path/to/zero'
      };

      (db.codeBucket.findFirst as any).mockResolvedValue(zeroBucket);
      (codeBucketService.syncCodeBuckets as any).mockResolvedValue(undefined);

      const handler = (syncCurrentDraftBucketToRepoQueueProcessor as any).handler;
      await handler({
        draftBucketOid: BigInt(0),
        immutableBucketOid: BigInt(0)
      });

      expect(codeBucketService.syncCodeBuckets).toHaveBeenCalled();
    });
  });
});
