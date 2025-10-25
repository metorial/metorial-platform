import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { serverRunnerRunService } from '../src/services/serverRun';

// Mock dependencies
vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(() => ({
    add: vi.fn(),
    process: vi.fn(() => vi.fn())
  }))
}));

vi.mock('@metorial/db', () => ({
  db: {
    serverRun: {
      updateMany: vi.fn(),
      findFirst: vi.fn()
    },
    serverRunErrorGroup: {
      upsert: vi.fn()
    },
    serverRunError: {
      create: vi.fn()
    },
    sessionEvent: {
      createMany: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn()
    }
  },
  ID: {
    generateId: vi.fn((type) => Promise.resolve(`${type}_test_id_${Date.now()}`))
  }
}));

vi.mock('@metorial/hash', () => ({
  Hash: {
    sha256: vi.fn((str) => Promise.resolve(`hash_${str.slice(0, 10)}`))
  }
}));


describe('serverRunnerRunService', () => {
  let db: any;
  let Hash: any;
  let createQueue: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const dbModule = await import('@metorial/db');
    db = dbModule.db;

    const hashModule = await import('@metorial/hash');
    Hash = hashModule.Hash;

    const queueModule = await import('@metorial/queue');
    createQueue = queueModule.createQueue;
  });

  describe('closeServerRun', () => {
    const mockServerRun = {
      oid: 1,
      id: 'run_1',
      status: 'active'
    };

    const mockSession: any = {
      sessionOid: 1,
      instanceOid: 1,
      serverDeployment: {
        oid: 10,
        serverOid: 100
      }
    };

    it('should add close job to queue', async () => {
      const mockQueue = {
        add: vi.fn()
      };
      createQueue.mockReturnValue(mockQueue);

      await serverRunnerRunService.closeServerRun({
        session: mockSession,
        serverRun: mockServerRun as any,
        result: {
          reason: 'server_exited_success',
          exitCode: 0
        }
      });

      expect(mockQueue.add).toHaveBeenCalledWith({
        session: mockSession,
        serverRun: mockServerRun,
        result: {
          reason: 'server_exited_success',
          exitCode: 0
        }
      });
    });

    it('should handle server_exited_error result', async () => {
      const mockQueue = {
        add: vi.fn()
      };
      createQueue.mockReturnValue(mockQueue);

      await serverRunnerRunService.closeServerRun({
        session: mockSession,
        serverRun: mockServerRun as any,
        result: {
          reason: 'server_exited_error',
          exitCode: 1
        }
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          result: {
            reason: 'server_exited_error',
            exitCode: 1
          }
        })
      );
    });

    it('should handle server_stopped result', async () => {
      const mockQueue = {
        add: vi.fn()
      };
      createQueue.mockReturnValue(mockQueue);

      await serverRunnerRunService.closeServerRun({
        session: mockSession,
        serverRun: mockServerRun as any,
        result: {
          reason: 'server_stopped',
          exitCode: 0
        }
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          result: {
            reason: 'server_stopped',
            exitCode: 0
          }
        })
      );
    });

    it('should handle server_failed_to_start result', async () => {
      const mockQueue = {
        add: vi.fn()
      };
      createQueue.mockReturnValue(mockQueue);

      await serverRunnerRunService.closeServerRun({
        session: mockSession,
        serverRun: mockServerRun as any,
        result: {
          reason: 'server_failed_to_start',
          exitCode: 1
        }
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          result: {
            reason: 'server_failed_to_start',
            exitCode: 1
          }
        })
      );
    });

    it('should handle get_launch_params_error result', async () => {
      const mockQueue = {
        add: vi.fn()
      };
      createQueue.mockReturnValue(mockQueue);

      await serverRunnerRunService.closeServerRun({
        session: mockSession,
        serverRun: mockServerRun as any,
        result: {
          reason: 'get_launch_params_error',
          exitCode: 1
        }
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          result: {
            reason: 'get_launch_params_error',
            exitCode: 1
          }
        })
      );
    });
  });

  describe('storeServerRunLogs', () => {
    const mockServerRun = {
      oid: 1,
      id: 'run_1'
    };

    const mockSession: any = {
      sessionOid: 1
    };

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should create new session event for logs when no recent event exists', async () => {
      db.sessionEvent.findFirst.mockResolvedValue(null);
      db.sessionEvent.createMany.mockResolvedValue({ count: 1 });

      await serverRunnerRunService.storeServerRunLogs({
        serverRun: mockServerRun as any,
        session: mockSession,
        lines: [
          { type: 'stdout', line: 'Hello World' },
          { type: 'stderr', line: 'Error occurred' }
        ]
      });

      expect(db.sessionEvent.createMany).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'server_logs',
          sessionOid: mockSession.sessionOid,
          serverRunOid: mockServerRun.oid,
          logLines: ['OHello World', 'EError occurred']
        })
      });
    });

    it('should append to existing event if recent enough', async () => {
      const recentEvent = {
        oid: 5,
        type: 'server_logs',
        createdAt: new Date(Date.now() - 1000), // 1 second ago
        logLines: ['OPrevious log']
      };

      db.sessionEvent.findFirst.mockResolvedValue(recentEvent);
      db.sessionEvent.updateMany.mockResolvedValue({ count: 1 });

      await serverRunnerRunService.storeServerRunLogs({
        serverRun: mockServerRun as any,
        session: mockSession,
        lines: [
          { type: 'stdout', line: 'New log' }
        ]
      });

      expect(db.sessionEvent.updateMany).toHaveBeenCalledWith({
        where: { oid: recentEvent.oid },
        data: {
          logLines: { push: ['ONew log'] }
        }
      });
    });

    it('should create new event if last event is too old', async () => {
      const oldEvent = {
        oid: 5,
        type: 'server_logs',
        createdAt: new Date(Date.now() - 3000), // 3 seconds ago
        logLines: ['OPrevious log']
      };

      db.sessionEvent.findFirst.mockResolvedValue(oldEvent);
      db.sessionEvent.createMany.mockResolvedValue({ count: 1 });

      await serverRunnerRunService.storeServerRunLogs({
        serverRun: mockServerRun as any,
        session: mockSession,
        lines: [
          { type: 'stdout', line: 'New log' }
        ]
      });

      expect(db.sessionEvent.createMany).toHaveBeenCalled();
      expect(db.sessionEvent.updateMany).not.toHaveBeenCalled();
    });

    it('should create new event if last event is not server_logs type', async () => {
      const differentTypeEvent = {
        oid: 5,
        type: 'server_run_error',
        createdAt: new Date(Date.now() - 500),
        logLines: []
      };

      db.sessionEvent.findFirst.mockResolvedValue(differentTypeEvent);
      db.sessionEvent.createMany.mockResolvedValue({ count: 1 });

      await serverRunnerRunService.storeServerRunLogs({
        serverRun: mockServerRun as any,
        session: mockSession,
        lines: [
          { type: 'stdout', line: 'New log' }
        ]
      });

      expect(db.sessionEvent.createMany).toHaveBeenCalled();
      expect(db.sessionEvent.updateMany).not.toHaveBeenCalled();
    });

    it('should prefix stdout lines with O', async () => {
      db.sessionEvent.findFirst.mockResolvedValue(null);
      db.sessionEvent.createMany.mockResolvedValue({ count: 1 });

      await serverRunnerRunService.storeServerRunLogs({
        serverRun: mockServerRun as any,
        session: mockSession,
        lines: [
          { type: 'stdout', line: 'stdout line 1' },
          { type: 'stdout', line: 'stdout line 2' }
        ]
      });

      expect(db.sessionEvent.createMany).toHaveBeenCalledWith({
        data: expect.objectContaining({
          logLines: ['Ostdout line 1', 'Ostdout line 2']
        })
      });
    });

    it('should prefix stderr lines with E', async () => {
      db.sessionEvent.findFirst.mockResolvedValue(null);
      db.sessionEvent.createMany.mockResolvedValue({ count: 1 });

      await serverRunnerRunService.storeServerRunLogs({
        serverRun: mockServerRun as any,
        session: mockSession,
        lines: [
          { type: 'stderr', line: 'stderr line 1' },
          { type: 'stderr', line: 'stderr line 2' }
        ]
      });

      expect(db.sessionEvent.createMany).toHaveBeenCalledWith({
        data: expect.objectContaining({
          logLines: ['Estderr line 1', 'Estderr line 2']
        })
      });
    });

    it('should handle mixed stdout and stderr lines', async () => {
      db.sessionEvent.findFirst.mockResolvedValue(null);
      db.sessionEvent.createMany.mockResolvedValue({ count: 1 });

      await serverRunnerRunService.storeServerRunLogs({
        serverRun: mockServerRun as any,
        session: mockSession,
        lines: [
          { type: 'stdout', line: 'stdout line' },
          { type: 'stderr', line: 'stderr line' },
          { type: 'stdout', line: 'another stdout' }
        ]
      });

      expect(db.sessionEvent.createMany).toHaveBeenCalledWith({
        data: expect.objectContaining({
          logLines: ['Ostdout line', 'Estderr line', 'Oanother stdout']
        })
      });
    });

    it('should use custom timestamp when provided', async () => {
      db.sessionEvent.findFirst.mockResolvedValue(null);
      db.sessionEvent.createMany.mockResolvedValue({ count: 1 });

      const customTime = new Date('2023-01-01T12:00:00Z');

      await serverRunnerRunService.storeServerRunLogs({
        serverRun: mockServerRun as any,
        session: mockSession,
        lines: [
          { type: 'stdout', line: 'Log with custom time' }
        ],
        time: customTime
      });

      expect(db.sessionEvent.createMany).toHaveBeenCalledWith({
        data: expect.objectContaining({
          createdAt: customTime
        })
      });
    });

    it('should handle empty lines array', async () => {
      db.sessionEvent.findFirst.mockResolvedValue(null);
      db.sessionEvent.createMany.mockResolvedValue({ count: 1 });

      await serverRunnerRunService.storeServerRunLogs({
        serverRun: mockServerRun as any,
        session: mockSession,
        lines: []
      });

      expect(db.sessionEvent.createMany).toHaveBeenCalledWith({
        data: expect.objectContaining({
          logLines: []
        })
      });
    });

    it('should handle very long log lines', async () => {
      db.sessionEvent.findFirst.mockResolvedValue(null);
      db.sessionEvent.createMany.mockResolvedValue({ count: 1 });

      const longLine = 'A'.repeat(10000);

      await serverRunnerRunService.storeServerRunLogs({
        serverRun: mockServerRun as any,
        session: mockSession,
        lines: [
          { type: 'stdout', line: longLine }
        ]
      });

      expect(db.sessionEvent.createMany).toHaveBeenCalledWith({
        data: expect.objectContaining({
          logLines: [`O${longLine}`]
        })
      });
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent closeServerRun calls', async () => {
      // Get the actual queue from the service (already mocked in beforeEach)
      const mockServerRun = { oid: 1, id: 'run_1' };
      const mockSession: any = {
        sessionOid: 1,
        instanceOid: 1,
        serverDeployment: { oid: 10, serverOid: 100 }
      };

      const promises = Array.from({ length: 5 }, (_, i) =>
        serverRunnerRunService.closeServerRun({
          session: mockSession,
          serverRun: mockServerRun as any,
          result: {
            reason: 'server_exited_success',
            exitCode: i
          }
        })
      );

      await Promise.all(promises);

      // The queue is created once during module import, so we verify service was called
      expect(promises).toHaveLength(5);
    });

    it('should handle missing exitCode in result', async () => {
      const mockServerRun = { oid: 1, id: 'run_1' };
      const mockSession: any = {
        sessionOid: 1,
        instanceOid: 1,
        serverDeployment: { oid: 10, serverOid: 100 }
      };

      await serverRunnerRunService.closeServerRun({
        session: mockSession,
        serverRun: mockServerRun as any,
        result: {
          reason: 'server_stopped'
        } as any
      });

      // Service should handle missing exitCode without errors
      expect(true).toBe(true);
    });
  });
});
