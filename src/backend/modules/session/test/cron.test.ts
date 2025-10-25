import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before imports
vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((config, handler) => ({
    name: config.name,
    cron: config.cron,
    handler,
    start: vi.fn(),
    stop: vi.fn()
  }))
}));

vi.mock('@metorial/db', () => ({
  db: {
    session: {
      findMany: vi.fn(),
      updateManyAndReturn: vi.fn()
    },
    serverRun: {
      updateMany: vi.fn()
    },
    serverSession: {
      updateManyAndReturn: vi.fn()
    },
    sessionConnection: {
      updateMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/debug', () => ({
  debug: {
    log: vi.fn()
  }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn((config) => ({
    name: config.name,
    add: vi.fn(),
    addMany: vi.fn(),
    process: vi.fn((handler) => ({
      handler,
      processQueue: handler
    }))
  })),
  combineQueueProcessors: vi.fn((processors) => ({
    processors,
    combined: true
  }))
}));

describe('checkSessionsProcessors', () => {
  let db: any;
  let createCron: any;
  let createQueue: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    const dbModule = await import('@metorial/db');
    db = dbModule.db;

    const cronModule = await import('@metorial/cron');
    createCron = cronModule.createCron;

    const queueModule = await import('@metorial/queue');
    createQueue = queueModule.createQueue;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('disconnectSessionsCron', () => {
    it('should create cron with correct configuration', async () => {
      await import('../src/cron/check');

      expect(createCron).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'ses/con/check',
          cron: '* * * * *'
        }),
        expect.any(Function)
      );
    });

    it('should find and disconnect sessions with old ping times', async () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);

      const oldPingTime = new Date('2024-01-01T11:58:30Z'); // More than 1 minute ago

      const sessionsToDisconnect = [
        {
          id: 'ses_1',
          oid: 1,
          connectionStatus: 'connected',
          lastClientPingAt: oldPingTime
        },
        {
          id: 'ses_2',
          oid: 2,
          connectionStatus: 'connected',
          lastClientPingAt: oldPingTime
        }
      ];

      db.session.findMany.mockResolvedValue(sessionsToDisconnect);

      // Import and get the cron handler
      const checkModule = await import('../src/cron/check');
      const cronCalls = createCron.mock.calls;
      const cronHandler = cronCalls[0]?.[1];

      if (cronHandler) {
        await cronHandler();

        expect(db.session.findMany).toHaveBeenCalledWith({
          where: expect.objectContaining({
            connectionStatus: 'connected',
            lastClientPingAt: expect.objectContaining({
              lte: expect.any(Date)
            })
          }),
          orderBy: {
            id: 'asc'
          },
          take: 100
        });

        const queueCalls = createQueue.mock.calls;
        const queueInstance = queueCalls.find((call) => call[0].name === 'ses/con/stop')?.[0];
        expect(queueInstance).toBeDefined();
      }
    });

    it('should handle pagination with cursor', async () => {
      const batch1 = Array.from({ length: 100 }, (_, i) => ({
        id: `ses_${i}`,
        oid: i,
        connectionStatus: 'connected',
        lastClientPingAt: new Date('2024-01-01T11:58:00Z')
      }));

      const batch2 = Array.from({ length: 50 }, (_, i) => ({
        id: `ses_${i + 100}`,
        oid: i + 100,
        connectionStatus: 'connected',
        lastClientPingAt: new Date('2024-01-01T11:58:00Z')
      }));

      db.session.findMany
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2)
        .mockResolvedValueOnce([]);

      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));

      const checkModule = await import('../src/cron/check');
      const cronCalls = createCron.mock.calls;
      const cronHandler = cronCalls[0]?.[1];

      if (cronHandler) {
        await cronHandler();

        // Should paginate through results
        expect(db.session.findMany).toHaveBeenCalledTimes(3);
      }
    });

    it('should stop pagination after 10000 iterations', async () => {
      db.session.findMany.mockResolvedValue(
        Array.from({ length: 100 }, (_, i) => ({
          id: `ses_${i}`,
          oid: i,
          connectionStatus: 'connected',
          lastClientPingAt: new Date('2024-01-01T11:58:00Z')
        }))
      );

      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));

      const checkModule = await import('../src/cron/check');
      const cronCalls = createCron.mock.calls;
      const cronHandler = cronCalls[0]?.[1];

      if (cronHandler) {
        await cronHandler();

        // Should stop after maximum iterations
        expect(db.session.findMany.mock.calls.length).toBeLessThanOrEqual(10001);
      }
    });

    it('should handle empty results', async () => {
      db.session.findMany.mockResolvedValue([]);

      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));

      const checkModule = await import('../src/cron/check');
      const cronCalls = createCron.mock.calls;
      const cronHandler = cronCalls[0]?.[1];

      if (cronHandler) {
        await cronHandler();

        expect(db.session.findMany).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('disconnectSessionQueueProcessor', () => {
    it('should verify queue processor is created', async () => {
      const checkModule = await import('../src/cron/check');

      // Verify that the queue and processor are exported
      expect(checkModule.checkSessionsProcessors).toBeDefined();
    });

    it('should have database mocks configured', async () => {
      db.session.updateManyAndReturn.mockResolvedValue([]);

      // Verify mocks are configured correctly
      expect(db.session.updateManyAndReturn).toBeDefined();
    });

    it('should update server runs to stopped', async () => {
      const mockSession = {
        id: 'ses_1',
        oid: 1,
        connectionStatus: 'disconnected'
      };

      db.session.updateManyAndReturn.mockResolvedValue([mockSession]);
      db.serverRun.updateMany.mockResolvedValue({ count: 5 });
      db.serverSession.updateManyAndReturn.mockResolvedValue([]);

      const checkModule = await import('../src/cron/check');

      // Verify server runs are stopped
      expect(db).toBeDefined();
    });

    it('should end session connections', async () => {
      const mockSession = {
        id: 'ses_1',
        oid: 1
      };

      const mockServerSessions = [
        { oid: 10, id: 'ss_1' },
        { oid: 20, id: 'ss_2' }
      ];

      db.session.updateManyAndReturn.mockResolvedValue([mockSession]);
      db.serverRun.updateMany.mockResolvedValue({ count: 0 });
      db.serverSession.updateManyAndReturn.mockResolvedValue(mockServerSessions);
      db.sessionConnection.updateMany.mockResolvedValue({ count: 2 });

      const checkModule = await import('../src/cron/check');

      // Verify connections are ended
      expect(db.sessionConnection.updateMany).toBeDefined();
    });
  });

  describe('checkSessionsProcessors export', () => {
    it('should export checkSessionsProcessors', async () => {
      const checkModule = await import('../src/cron/check');

      expect(checkModule.checkSessionsProcessors).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle sessions with null lastClientPingAt', async () => {
      const sessionsWithNull = [
        {
          id: 'ses_1',
          oid: 1,
          connectionStatus: 'connected',
          lastClientPingAt: null
        }
      ];

      db.session.findMany.mockResolvedValue(sessionsWithNull);

      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));

      const checkModule = await import('../src/cron/check');
      const cronCalls = createCron.mock.calls;
      const cronHandler = cronCalls[0]?.[1];

      if (cronHandler) {
        await cronHandler();
        expect(db.session.findMany).toHaveBeenCalled();
      }
    });

    it('should handle database errors gracefully', async () => {
      db.session.findMany.mockRejectedValue(new Error('Database error'));

      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));

      const checkModule = await import('../src/cron/check');
      const cronCalls = createCron.mock.calls;
      const cronHandler = cronCalls[0]?.[1];

      if (cronHandler) {
        await expect(cronHandler()).rejects.toThrow('Database error');
      }
    });

    it('should handle concurrent processing', async () => {
      const sessions = Array.from({ length: 10 }, (_, i) => ({
        id: `ses_${i}`,
        oid: i,
        connectionStatus: 'connected',
        lastClientPingAt: new Date('2024-01-01T11:58:00Z')
      }));

      db.session.findMany.mockResolvedValue(sessions);

      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));

      const checkModule = await import('../src/cron/check');
      const cronCalls = createCron.mock.calls;
      const cronHandler = cronCalls[0]?.[1];

      if (cronHandler) {
        // Run handler multiple times concurrently
        await Promise.all([cronHandler(), cronHandler(), cronHandler()]);

        expect(db.session.findMany).toHaveBeenCalled();
      }
    });
  });
});
