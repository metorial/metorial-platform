import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockDbFindUnique = vi.fn();
const mockDbCount = vi.fn();
const mockDbUpsert = vi.fn();
const mockQueueAdd = vi.fn();
const mockQueueProcess = vi.fn((handler) => handler);
const mockCreateQueue = vi.fn(() => ({
  add: mockQueueAdd,
  process: mockQueueProcess
}));
const mockGenerateId = vi.fn(() => 'generated-id');

vi.mock('@metorial/db', () => ({
  db: {
    providerOAuthConnection: {
      findUnique: mockDbFindUnique
    },
    providerOAuthConnectionAuthToken: {
      count: mockDbCount
    },
    providerOAuthConnectionAuthAttempt: {
      count: mockDbCount
    },
    providerOAuthConnectionEvent: {
      upsert: mockDbUpsert
    }
  },
  ID: {
    generateId: mockGenerateId
  }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: mockCreateQueue,
  QueueRetryError: class QueueRetryError extends Error {}
}));

vi.mock('date-fns', () => ({
  startOfWeek: vi.fn(() => new Date('2025-01-20')),
  subDays: vi.fn(() => new Date('2025-01-16'))
}));

describe('queue/errorCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('errorCheckQueue', () => {
    it('should create queue with correct configuration', async () => {
      await import('../src/queue/errorCheck');

      expect(mockCreateQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'oat/err-chk',
          workerOpts: expect.objectContaining({
            concurrency: 10,
            limiter: { max: 25, duration: 1000 }
          })
        })
      );
    });

    it('should export errorCheckQueueProcessor', async () => {
      const module = await import('../src/queue/errorCheck');
      expect(module.errorCheckQueueProcessor).toBeDefined();
    });

    it('should export addErrorCheck function', async () => {
      const module = await import('../src/queue/errorCheck');
      expect(module.addErrorCheck).toBeDefined();
      expect(typeof module.addErrorCheck).toBe('function');
    });
  });

  describe('errorCheckQueueProcessor', () => {
    let processorFn: any;

    beforeEach(async () => {
      vi.resetModules();
      mockQueueProcess.mockImplementation((handler) => {
        processorFn = handler;
        return handler;
      });
      await import('../src/queue/errorCheck');
    });

    it('should throw QueueRetryError if connection not found', async () => {
      mockDbFindUnique.mockResolvedValue(null);

      await expect(processorFn({ connectionId: 'test-id' })).rejects.toThrow();
    });

    it('should not create event when error ratio is low', async () => {
      const mockConnection = { id: 'test-id', oid: 1n };
      mockDbFindUnique.mockResolvedValue(mockConnection);

      // Setup: 100 tokens, 5 errors (5% error rate)
      mockDbCount
        .mockResolvedValueOnce(100) // totalRecentTokens
        .mockResolvedValueOnce(5)   // errorTokens
        .mockResolvedValueOnce(100) // totalRecentAuths
        .mockResolvedValueOnce(5);  // errorAuths

      await processorFn({ connectionId: 'test-id' });

      expect(mockDbUpsert).not.toHaveBeenCalled();
    });

    it('should create event when token error ratio exceeds threshold', async () => {
      const mockConnection = { id: 'test-id', oid: 1n };
      mockDbFindUnique.mockResolvedValue(mockConnection);

      // Setup: 100 tokens, 20 errors (20% error rate > 15% threshold)
      mockDbCount
        .mockResolvedValueOnce(100) // totalRecentTokens
        .mockResolvedValueOnce(20)  // errorTokens
        .mockResolvedValueOnce(100) // totalRecentAuths
        .mockResolvedValueOnce(5);  // errorAuths

      await processorFn({ connectionId: 'test-id' });

      expect(mockDbUpsert).toHaveBeenCalled();
    });

    it('should create event when auth error ratio exceeds threshold', async () => {
      const mockConnection = { id: 'test-id', oid: 1n };
      mockDbFindUnique.mockResolvedValue(mockConnection);

      // Setup: 100 auths, 20 errors (20% error rate > 15% threshold)
      mockDbCount
        .mockResolvedValueOnce(100) // totalRecentTokens
        .mockResolvedValueOnce(5)   // errorTokens
        .mockResolvedValueOnce(100) // totalRecentAuths
        .mockResolvedValueOnce(20); // errorAuths

      await processorFn({ connectionId: 'test-id' });

      expect(mockDbUpsert).toHaveBeenCalled();
    });

    it('should include error statistics in event metadata', async () => {
      const mockConnection = { id: 'test-id', oid: 1n };
      mockDbFindUnique.mockResolvedValue(mockConnection);

      mockDbCount
        .mockResolvedValueOnce(100) // totalRecentTokens
        .mockResolvedValueOnce(20)  // errorTokens
        .mockResolvedValueOnce(100) // totalRecentAuths
        .mockResolvedValueOnce(20); // errorAuths

      await processorFn({ connectionId: 'test-id' });

      expect(mockDbUpsert).toHaveBeenCalledWith({
        where: expect.any(Object),
        update: {
          metadata: {
            tokens: {
              total: 100,
              errors: 20,
              ratio: 0.2
            },
            auths: {
              total: 100,
              errors: 20,
              ratio: 0.2
            }
          }
        },
        create: expect.objectContaining({
          metadata: {
            tokens: {
              total: 100,
              errors: 20,
              ratio: 0.2
            },
            auths: {
              total: 100,
              errors: 20,
              ratio: 0.2
            }
          }
        })
      });
    });

    it('should use week discriminator for event deduplication', async () => {
      const mockConnection = { id: 'test-id', oid: 1n };
      mockDbFindUnique.mockResolvedValue(mockConnection);

      mockDbCount
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(20);

      await processorFn({ connectionId: 'test-id' });

      const discriminator = new Date('2025-01-20').getTime().toString(36);
      expect(mockDbUpsert).toHaveBeenCalledWith({
        where: {
          connectionOid_event_discriminator: {
            connectionOid: 1n,
            event: 'errors',
            discriminator
          }
        },
        update: expect.any(Object),
        create: expect.any(Object)
      });
    });

    it('should handle low sample size (<=5 tokens)', async () => {
      const mockConnection = { id: 'test-id', oid: 1n };
      mockDbFindUnique.mockResolvedValue(mockConnection);

      // Low sample size: 3 tokens, 2 errors (should not trigger)
      mockDbCount
        .mockResolvedValueOnce(3)   // totalRecentTokens
        .mockResolvedValueOnce(2)   // errorTokens
        .mockResolvedValueOnce(100) // totalRecentAuths
        .mockResolvedValueOnce(5);  // errorAuths

      await processorFn({ connectionId: 'test-id' });

      expect(mockDbUpsert).not.toHaveBeenCalled();
    });

    it('should handle low sample size (<=5 auths)', async () => {
      const mockConnection = { id: 'test-id', oid: 1n };
      mockDbFindUnique.mockResolvedValue(mockConnection);

      // Low sample size: 3 auths, 2 errors (should not trigger)
      mockDbCount
        .mockResolvedValueOnce(100) // totalRecentTokens
        .mockResolvedValueOnce(5)   // errorTokens
        .mockResolvedValueOnce(3)   // totalRecentAuths
        .mockResolvedValueOnce(2);  // errorAuths

      await processorFn({ connectionId: 'test-id' });

      expect(mockDbUpsert).not.toHaveBeenCalled();
    });

    it('should query for 4-day timeframe', async () => {
      const mockConnection = { id: 'test-id', oid: 1n };
      mockDbFindUnique.mockResolvedValue(mockConnection);

      mockDbCount.mockResolvedValue(0);

      await processorFn({ connectionId: 'test-id' });

      // Verify subDays was called (mocked to return specific date)
      expect(mockDbCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            connectionOid: 1n,
            lastUsedAt: { gte: new Date('2025-01-16') }
          })
        })
      );
    });
  });

  describe('addErrorCheck', () => {
    let addErrorCheck: any;

    beforeEach(async () => {
      vi.resetModules();
      const module = await import('../src/queue/errorCheck');
      addErrorCheck = module.addErrorCheck;
    });

    it('should add job to queue with connection id', async () => {
      await addErrorCheck('test-connection-id');

      expect(mockQueueAdd).toHaveBeenCalledWith(
        { connectionId: 'test-connection-id' },
        expect.any(Object)
      );
    });

    it('should add job with 30 minute delay', async () => {
      await addErrorCheck('test-connection-id');

      expect(mockQueueAdd).toHaveBeenCalledWith(
        expect.any(Object),
        { id: 'test-connection-id', delay: 1000 * 60 * 30 }
      );
    });

    it('should use connection id as job id', async () => {
      await addErrorCheck('unique-connection-id');

      expect(mockQueueAdd).toHaveBeenCalledWith(
        { connectionId: 'unique-connection-id' },
        { id: 'unique-connection-id', delay: expect.any(Number) }
      );
    });

    it('should handle special characters in connection id', async () => {
      const specialId = 'conn-!@#$%^&*()';
      await addErrorCheck(specialId);

      expect(mockQueueAdd).toHaveBeenCalledWith(
        { connectionId: specialId },
        { id: specialId, delay: expect.any(Number) }
      );
    });
  });

  describe('edge cases', () => {
    let processorFn: any;

    beforeEach(async () => {
      vi.resetModules();
      mockQueueProcess.mockImplementation((handler) => {
        processorFn = handler;
        return handler;
      });
      await import('../src/queue/errorCheck');
    });

    it('should handle exactly 15% threshold for tokens', async () => {
      const mockConnection = { id: 'test-id', oid: 1n };
      mockDbFindUnique.mockResolvedValue(mockConnection);

      // Exactly 15%: should not trigger (> 0.15, not >= 0.15)
      mockDbCount
        .mockResolvedValueOnce(100) // totalRecentTokens
        .mockResolvedValueOnce(15)  // errorTokens (exactly 15%)
        .mockResolvedValueOnce(100) // totalRecentAuths
        .mockResolvedValueOnce(0);  // errorAuths

      await processorFn({ connectionId: 'test-id' });

      expect(mockDbUpsert).not.toHaveBeenCalled();
    });

    it('should handle 15.1% threshold (just above)', async () => {
      const mockConnection = { id: 'test-id', oid: 1n };
      mockDbFindUnique.mockResolvedValue(mockConnection);

      mockDbCount
        .mockResolvedValueOnce(1000) // totalRecentTokens
        .mockResolvedValueOnce(151)  // errorTokens (15.1%)
        .mockResolvedValueOnce(100)  // totalRecentAuths
        .mockResolvedValueOnce(0);   // errorAuths

      await processorFn({ connectionId: 'test-id' });

      expect(mockDbUpsert).toHaveBeenCalled();
    });

    it('should handle zero errors', async () => {
      const mockConnection = { id: 'test-id', oid: 1n };
      mockDbFindUnique.mockResolvedValue(mockConnection);

      mockDbCount
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(0);

      await processorFn({ connectionId: 'test-id' });

      expect(mockDbUpsert).not.toHaveBeenCalled();
    });

    it('should handle all errors scenario', async () => {
      const mockConnection = { id: 'test-id', oid: 1n };
      mockDbFindUnique.mockResolvedValue(mockConnection);

      // 100% error rate
      mockDbCount
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(100);

      await processorFn({ connectionId: 'test-id' });

      expect(mockDbUpsert).toHaveBeenCalled();
      expect(mockDbUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: {
            metadata: expect.objectContaining({
              tokens: expect.objectContaining({ ratio: 1 }),
              auths: expect.objectContaining({ ratio: 1 })
            })
          }
        })
      );
    });

    it('should generate unique event id', async () => {
      const mockConnection = { id: 'test-id', oid: 1n };
      mockDbFindUnique.mockResolvedValue(mockConnection);

      mockDbCount
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(20);

      await processorFn({ connectionId: 'test-id' });

      expect(mockGenerateId).toHaveBeenCalledWith('oauthConnectionEvent');
      expect(mockDbUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            id: 'generated-id'
          })
        })
      );
    });
  });
});
