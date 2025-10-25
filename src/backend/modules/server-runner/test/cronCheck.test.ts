import { describe, it, expect, vi, beforeEach } from 'vitest';
import { subMinutes } from 'date-fns';

// Create mock handlers that we can capture
let capturedCronHandler: any;
let capturedQueueHandler: any;
const queueInstances = new Map<string, any>();

// Mock dependencies
vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((config, handler) => {
    capturedCronHandler = handler;
    return {
      name: config.name,
      cron: config.cron,
      handler,
      process: vi.fn(() => vi.fn())
    };
  })
}));

vi.mock('@metorial/queue', () => {
  return {
    createQueue: vi.fn((config) => {
      const name = config?.name || 'default';

      if (queueInstances.has(name)) {
        return queueInstances.get(name);
      }

      const queue: any = {
        add: vi.fn(),
        addMany: vi.fn(),
        process: vi.fn((handler) => {
          capturedQueueHandler = handler;
          return {
            start: vi.fn(() => Promise.resolve({ close: vi.fn() }))
          };
        })
      };

      queueInstances.set(name, queue);
      return queue;
    }),
    combineQueueProcessors: vi.fn((processors) => ({
      processors
    }))
  };
});

vi.mock('@metorial/db', () => ({
  db: {
    serverRunner: {
      findMany: vi.fn(),
      findFirst: vi.fn()
    }
  }
}));

vi.mock('../src/services', () => ({
  serverRunnerConnectionService: {
    unregisterServerRunner: vi.fn()
  }
}));

describe('cron check module', () => {
  let db: any;
  let createCron: any;
  let createQueue: any;
  let serverRunnerConnectionService: any;
  let mockQueue: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    capturedCronHandler = null;
    capturedQueueHandler = null;
    queueInstances.clear();

    const dbModule = await import('@metorial/db');
    db = dbModule.db;

    const cronModule = await import('@metorial/cron');
    createCron = cronModule.createCron;

    const queueModule = await import('@metorial/queue');
    createQueue = queueModule.createQueue;

    const servicesModule = await import('../src/services');
    serverRunnerConnectionService = servicesModule.serverRunnerConnectionService;

    // Import the module to set up handlers
    await import('../src/cron/check');

    // Get the mock queue that was created for 'srn/run/stop'
    mockQueue = queueInstances.get('srn/run/stop') || {
      addMany: vi.fn(),
      process: vi.fn((handler) => {
        capturedQueueHandler = handler;
        return { start: vi.fn(() => Promise.resolve({ close: vi.fn() })) };
      })
    };
  });

  describe('checkRunnersCron', () => {
    it('should create cron job with correct config', () => {
      expect(createCron).toHaveBeenCalledWith(
        {
          name: 'srn/run/check',
          cron: '* * * * *'
        },
        expect.any(Function)
      );
    });

    it('should find and stop inactive runners', async () => {
      const twoMinutesAgo = subMinutes(new Date(), 2);

      const inactiveRunners = [
        {
          id: 'runner_1',
          status: 'online',
          lastSeenAt: twoMinutesAgo
        },
        {
          id: 'runner_2',
          status: 'online',
          lastSeenAt: twoMinutesAgo
        }
      ];

      db.serverRunner.findMany.mockResolvedValue(inactiveRunners);

      // Execute the cron handler
      await capturedCronHandler();

      expect(db.serverRunner.findMany).toHaveBeenCalledWith({
        where: {
          status: 'online',
          lastSeenAt: {
            lte: expect.any(Date)
          },
          id: {
            gt: undefined
          }
        },
        orderBy: {
          id: 'asc'
        },
        take: 100
      });

      expect(mockQueue.addMany).toHaveBeenCalledWith([
        {
          runnerId: 'runner_1',
          lastSeenAt: twoMinutesAgo
        },
        {
          runnerId: 'runner_2',
          lastSeenAt: twoMinutesAgo
        }
      ]);
    });

    it('should handle pagination with cursor', async () => {
      const twoMinutesAgo = subMinutes(new Date(), 2);

      // First batch
      const batch1 = Array.from({ length: 100 }, (_, i) => ({
        id: `runner_${i}`,
        status: 'online',
        lastSeenAt: twoMinutesAgo
      }));

      // Second batch
      const batch2 = Array.from({ length: 50 }, (_, i) => ({
        id: `runner_${100 + i}`,
        status: 'online',
        lastSeenAt: twoMinutesAgo
      }));

      db.serverRunner.findMany
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2)
        .mockResolvedValueOnce([]);

      await capturedCronHandler();

      // Should be called 3 times (2 batches + 1 empty)
      expect(db.serverRunner.findMany).toHaveBeenCalledTimes(3);

      // Check cursor usage
      expect(db.serverRunner.findMany).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          where: expect.objectContaining({
            id: {
              gt: 'runner_99'
            }
          })
        })
      );

      expect(db.serverRunner.findMany).toHaveBeenNthCalledWith(3,
        expect.objectContaining({
          where: expect.objectContaining({
            id: {
              gt: 'runner_149'
            }
          })
        })
      );
    });

    it('should stop after 10,000 iterations', async () => {
      const twoMinutesAgo = subMinutes(new Date(), 2);

      // Always return a full batch
      db.serverRunner.findMany.mockResolvedValue(
        Array.from({ length: 100 }, (_, i) => ({
          id: `runner_${i}`,
          status: 'online',
          lastSeenAt: twoMinutesAgo
        }))
      );

      await capturedCronHandler();

      // Should stop at 10,000 iterations max
      expect(db.serverRunner.findMany).toHaveBeenCalledTimes(10000);
    });

    it('should only process online runners', async () => {
      db.serverRunner.findMany.mockResolvedValue([]);

      await capturedCronHandler();

      expect(db.serverRunner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'online'
          })
        })
      );
    });

    it('should filter by lastSeenAt older than 1 minute', async () => {
      const now = new Date();

      db.serverRunner.findMany.mockResolvedValue([]);

      await capturedCronHandler();

      const call = db.serverRunner.findMany.mock.calls[0][0];
      const lastSeenAtFilter = call.where.lastSeenAt.lte;

      // Should be approximately 1 minute ago
      const diffMs = now.getTime() - lastSeenAtFilter.getTime();
      expect(diffMs).toBeGreaterThan(55000); // At least 55 seconds
      expect(diffMs).toBeLessThan(65000); // At most 65 seconds
    });

    it('should handle empty result set', async () => {
      db.serverRunner.findMany.mockResolvedValue([]);

      await capturedCronHandler();

      expect(db.serverRunner.findMany).toHaveBeenCalledTimes(1);
      expect(mockQueue.addMany).not.toHaveBeenCalled();
    });
  });

  describe('stopRunnerQueue processor', () => {
    it('should unregister runner if found with matching lastSeenAt', async () => {
      const mockRunner = {
        id: 'runner_1',
        status: 'online',
        lastSeenAt: new Date('2024-01-01T12:00:00Z')
      };

      db.serverRunner.findFirst.mockResolvedValue(mockRunner);
      serverRunnerConnectionService.unregisterServerRunner.mockResolvedValue(undefined);

      await capturedQueueHandler({
        runnerId: 'runner_1',
        lastSeenAt: mockRunner.lastSeenAt
      });

      expect(db.serverRunner.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'runner_1',
          lastSeenAt: mockRunner.lastSeenAt
        }
      });

      expect(serverRunnerConnectionService.unregisterServerRunner).toHaveBeenCalledWith({
        runner: mockRunner
      });
    });

    it('should not unregister if runner not found', async () => {
      db.serverRunner.findFirst.mockResolvedValue(null);

      await capturedQueueHandler({
        runnerId: 'runner_1',
        lastSeenAt: new Date()
      });

      expect(serverRunnerConnectionService.unregisterServerRunner).not.toHaveBeenCalled();
    });

    it('should not unregister if lastSeenAt does not match', async () => {
      const oldLastSeenAt = new Date('2024-01-01T12:00:00Z');

      db.serverRunner.findFirst.mockResolvedValue(null);

      await capturedQueueHandler({
        runnerId: 'runner_1',
        lastSeenAt: oldLastSeenAt
      });

      expect(db.serverRunner.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'runner_1',
          lastSeenAt: oldLastSeenAt
        }
      });

      expect(serverRunnerConnectionService.unregisterServerRunner).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      db.serverRunner.findFirst.mockRejectedValue(new Error('Database error'));

      await expect(
        capturedQueueHandler({
          runnerId: 'runner_1',
          lastSeenAt: new Date()
        })
      ).rejects.toThrow('Database error');
    });
  });

  describe('edge cases', () => {
    it('should handle null lastSeenAt values', async () => {
      const mockRunner = {
        id: 'runner_1',
        status: 'online',
        lastSeenAt: null
      };

      db.serverRunner.findFirst.mockResolvedValue(mockRunner);
      serverRunnerConnectionService.unregisterServerRunner.mockResolvedValue(undefined);

      await capturedQueueHandler({
        runnerId: 'runner_1',
        lastSeenAt: null
      });

      expect(serverRunnerConnectionService.unregisterServerRunner).toHaveBeenCalledWith({
        runner: mockRunner
      });
    });

    it('should handle very large number of inactive runners', async () => {
      const twoMinutesAgo = subMinutes(new Date(), 2);

      // Create a large batch
      const largeRunners = Array.from({ length: 1000 }, (_, i) => ({
        id: `runner_${i}`,
        status: 'online',
        lastSeenAt: twoMinutesAgo
      }));

      // Return multiple batches
      db.serverRunner.findMany
        .mockResolvedValueOnce(largeRunners.slice(0, 100))
        .mockResolvedValueOnce(largeRunners.slice(100, 200))
        .mockResolvedValueOnce(largeRunners.slice(200, 300))
        .mockResolvedValue([]);

      await capturedCronHandler();

      expect(mockQueue.addMany).toHaveBeenCalledTimes(3);
    });

    it('should handle concurrent cron executions', async () => {
      const twoMinutesAgo = subMinutes(new Date(), 2);

      db.serverRunner.findMany.mockResolvedValue([
        {
          id: 'runner_1',
          status: 'online',
          lastSeenAt: twoMinutesAgo
        }
      ]);

      // Execute multiple times concurrently
      await Promise.all([
        capturedCronHandler(),
        capturedCronHandler(),
        capturedCronHandler()
      ]);

      expect(mockQueue.addMany).toHaveBeenCalled();
    });
  });
});
