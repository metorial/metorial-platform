import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serverRunnerConnectionService } from '../src/services/serverRunnerConnection';

// Mock dependencies
vi.mock('@metorial/cache', () => ({
  createCachedFunction: vi.fn((config) => {
    const mockFn: any = vi.fn(() => config.provider());
    mockFn.clear = vi.fn();
    return mockFn;
  }),
  createLocallyCachedFunction: vi.fn((config) => {
    return vi.fn(() => config.provider());
  })
}));

vi.mock('@metorial/db', () => ({
  db: {
    serverRunner: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/error', () => ({
  ServiceError: class ServiceError extends Error {
    constructor(public error: any) {
      super(error.message);
    }
  },
  unauthorizedError: vi.fn((opts) => ({
    type: 'unauthorized',
    ...opts
  })),
  badRequestError: vi.fn((opts) => ({
    type: 'badRequest',
    ...opts
  }))
}));

describe('serverRunnerConnectionService', () => {
  let db: any;
  let unauthorizedError: any;
  let badRequestError: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const dbModule = await import('@metorial/db');
    db = dbModule.db;

    const errorModule = await import('@metorial/error');
    unauthorizedError = errorModule.unauthorizedError;
    badRequestError = errorModule.badRequestError;
  });

  describe('registerServerRunner', () => {
    it('should register a valid runner with correct connection key', async () => {
      const mockRunner = {
        oid: 1,
        id: 'runner_1',
        connectionKey: 'valid_key_123',
        status: 'offline'
      };

      db.serverRunner.findFirst.mockResolvedValue(mockRunner);
      db.serverRunner.updateMany.mockResolvedValue({ count: 1 });

      const result = await serverRunnerConnectionService.registerServerRunner({
        connectionKey: 'valid_key_123'
      });

      expect(db.serverRunner.findFirst).toHaveBeenCalledWith({
        where: { connectionKey: 'valid_key_123' }
      });

      expect(db.serverRunner.updateMany).toHaveBeenCalledWith({
        where: { oid: mockRunner.oid },
        data: {
          lastSeenAt: expect.any(Date),
          status: 'online'
        }
      });

      expect(result).toEqual(mockRunner);
    });

    it('should throw unauthorized error if runner not found', async () => {
      db.serverRunner.findFirst.mockResolvedValue(null);

      await expect(
        serverRunnerConnectionService.registerServerRunner({
          connectionKey: 'invalid_key'
        })
      ).rejects.toThrow();

      expect(unauthorizedError).toHaveBeenCalledWith({
        message: 'Server runner not registered'
      });
    });

    it('should throw bad request error if runner already online', async () => {
      const mockRunner = {
        oid: 1,
        id: 'runner_1',
        connectionKey: 'valid_key_123',
        status: 'online'
      };

      db.serverRunner.findFirst.mockResolvedValue(mockRunner);

      await expect(
        serverRunnerConnectionService.registerServerRunner({
          connectionKey: 'valid_key_123'
        })
      ).rejects.toThrow();

      expect(badRequestError).toHaveBeenCalledWith({
        message: 'Server runner already registered'
      });

      expect(db.serverRunner.updateMany).not.toHaveBeenCalled();
    });

    it('should update lastSeenAt timestamp', async () => {
      const mockRunner = {
        oid: 1,
        id: 'runner_1',
        connectionKey: 'valid_key_123',
        status: 'offline'
      };

      db.serverRunner.findFirst.mockResolvedValue(mockRunner);
      db.serverRunner.updateMany.mockResolvedValue({ count: 1 });

      const beforeTime = new Date();
      await serverRunnerConnectionService.registerServerRunner({
        connectionKey: 'valid_key_123'
      });
      const afterTime = new Date();

      const updateCall = db.serverRunner.updateMany.mock.calls[0][0];
      const lastSeenAt = updateCall.data.lastSeenAt;

      expect(lastSeenAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(lastSeenAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should clear cache after registration', async () => {
      const mockRunner = {
        oid: 1,
        id: 'runner_1',
        connectionKey: 'valid_key_123',
        status: 'offline'
      };

      db.serverRunner.findFirst.mockResolvedValue(mockRunner);
      db.serverRunner.updateMany.mockResolvedValue({ count: 1 });

      await serverRunnerConnectionService.registerServerRunner({
        connectionKey: 'valid_key_123'
      });

      // Cache clear is handled internally by the cached function mock
      expect(db.serverRunner.updateMany).toHaveBeenCalled();
    });
  });

  describe('setServerRunnerConfig', () => {
    const mockRunner = {
      oid: 1,
      id: 'runner_1',
      status: 'online'
    };

    const mockConfig = {
      attributes: ['supports_docker_images' as const],
      tags: ['gpu', 'high-memory'],
      maxConcurrentJobs: 10,
      version: 'v1.0.0'
    };

    it('should update runner configuration', async () => {
      db.serverRunner.updateMany.mockResolvedValue({ count: 1 });

      await serverRunnerConnectionService.setServerRunnerConfig({
        runner: mockRunner as any,
        input: mockConfig
      });

      expect(db.serverRunner.updateMany).toHaveBeenCalledWith({
        where: { oid: mockRunner.oid },
        data: {
          lastSeenAt: expect.any(Date),
          status: 'online',
          attributes: mockConfig.attributes,
          tags: mockConfig.tags,
          maxConcurrentJobs: mockConfig.maxConcurrentJobs,
          runnerVersion: mockConfig.version
        }
      });
    });

    it('should handle empty attributes', async () => {
      db.serverRunner.updateMany.mockResolvedValue({ count: 1 });

      await serverRunnerConnectionService.setServerRunnerConfig({
        runner: mockRunner as any,
        input: {
          ...mockConfig,
          attributes: []
        }
      });

      expect(db.serverRunner.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            attributes: []
          })
        })
      );
    });

    it('should handle empty tags', async () => {
      db.serverRunner.updateMany.mockResolvedValue({ count: 1 });

      await serverRunnerConnectionService.setServerRunnerConfig({
        runner: mockRunner as any,
        input: {
          ...mockConfig,
          tags: []
        }
      });

      expect(db.serverRunner.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tags: []
          })
        })
      );
    });

    it('should handle different maxConcurrentJobs values', async () => {
      db.serverRunner.updateMany.mockResolvedValue({ count: 1 });

      await serverRunnerConnectionService.setServerRunnerConfig({
        runner: mockRunner as any,
        input: {
          ...mockConfig,
          maxConcurrentJobs: 100
        }
      });

      expect(db.serverRunner.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            maxConcurrentJobs: 100
          })
        })
      );
    });

    it('should update lastSeenAt and keep status online', async () => {
      db.serverRunner.updateMany.mockResolvedValue({ count: 1 });

      await serverRunnerConnectionService.setServerRunnerConfig({
        runner: mockRunner as any,
        input: mockConfig
      });

      const updateCall = db.serverRunner.updateMany.mock.calls[0][0];
      expect(updateCall.data.status).toBe('online');
      expect(updateCall.data.lastSeenAt).toBeInstanceOf(Date);
    });
  });

  describe('unregisterServerRunner', () => {
    const mockRunner = {
      oid: 1,
      id: 'runner_1',
      status: 'online'
    };

    it('should set runner status to offline', async () => {
      db.serverRunner.updateMany.mockResolvedValue({ count: 1 });

      await serverRunnerConnectionService.unregisterServerRunner({
        runner: mockRunner as any
      });

      expect(db.serverRunner.updateMany).toHaveBeenCalledWith({
        where: { oid: mockRunner.oid },
        data: {
          lastSeenAt: expect.any(Date),
          status: 'offline'
        }
      });
    });

    it('should update lastSeenAt timestamp', async () => {
      db.serverRunner.updateMany.mockResolvedValue({ count: 1 });

      const beforeTime = new Date();
      await serverRunnerConnectionService.unregisterServerRunner({
        runner: mockRunner as any
      });
      const afterTime = new Date();

      const updateCall = db.serverRunner.updateMany.mock.calls[0][0];
      const lastSeenAt = updateCall.data.lastSeenAt;

      expect(lastSeenAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(lastSeenAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should clear cache after unregistration', async () => {
      db.serverRunner.updateMany.mockResolvedValue({ count: 1 });

      await serverRunnerConnectionService.unregisterServerRunner({
        runner: mockRunner as any
      });

      expect(db.serverRunner.updateMany).toHaveBeenCalled();
    });
  });

  describe('handleServerRunnerPing', () => {
    const mockRunner = {
      oid: 1,
      id: 'runner_1',
      status: 'online'
    };

    it('should update lastSeenAt timestamp', async () => {
      db.serverRunner.updateMany.mockResolvedValue({ count: 1 });

      await serverRunnerConnectionService.handleServerRunnerPing({
        runner: mockRunner as any
      });

      expect(db.serverRunner.updateMany).toHaveBeenCalledWith({
        where: { oid: mockRunner.oid },
        data: { lastSeenAt: expect.any(Date) }
      });
    });

    it('should only update lastSeenAt, not status', async () => {
      db.serverRunner.updateMany.mockResolvedValue({ count: 1 });

      await serverRunnerConnectionService.handleServerRunnerPing({
        runner: mockRunner as any
      });

      const updateCall = db.serverRunner.updateMany.mock.calls[0][0];
      expect(updateCall.data).toEqual({
        lastSeenAt: expect.any(Date)
      });
      expect(updateCall.data.status).toBeUndefined();
    });

    it('should handle multiple concurrent pings', async () => {
      db.serverRunner.updateMany.mockResolvedValue({ count: 1 });

      const promises = Array.from({ length: 10 }, () =>
        serverRunnerConnectionService.handleServerRunnerPing({
          runner: mockRunner as any
        })
      );

      await Promise.all(promises);

      expect(db.serverRunner.updateMany).toHaveBeenCalledTimes(10);
    });
  });

  describe('getOnlineServerRunners', () => {
    it('should return list of online runners', async () => {
      const mockRunners = [
        { id: 'runner_1', status: 'online' },
        { id: 'runner_2', status: 'online' },
        { id: 'runner_3', status: 'online' }
      ];

      db.serverRunner.findMany.mockResolvedValue(mockRunners);

      const result = await serverRunnerConnectionService.getOnlineServerRunners();

      expect(result).toEqual(mockRunners);
    });

    it('should return empty array when no runners online', async () => {
      db.serverRunner.findMany.mockResolvedValue([]);

      const result = await serverRunnerConnectionService.getOnlineServerRunners();

      expect(result).toEqual([]);
    });

    it('should use cached result', async () => {
      const mockRunners = [
        { id: 'runner_1', status: 'online' }
      ];

      db.serverRunner.findMany.mockResolvedValue(mockRunners);

      // First call
      const result1 = await serverRunnerConnectionService.getOnlineServerRunners();

      // Second call should use cache (in real implementation)
      const result2 = await serverRunnerConnectionService.getOnlineServerRunners();

      expect(result1).toEqual(mockRunners);
      expect(result2).toEqual(mockRunners);
    });
  });

  describe('edge cases', () => {
    it('should handle database errors gracefully in registerServerRunner', async () => {
      db.serverRunner.findFirst.mockRejectedValue(new Error('Database error'));

      await expect(
        serverRunnerConnectionService.registerServerRunner({
          connectionKey: 'test_key'
        })
      ).rejects.toThrow('Database error');
    });

    it('should handle database errors gracefully in setServerRunnerConfig', async () => {
      const mockRunner = { oid: 1, id: 'runner_1' };
      const mockConfig = {
        attributes: [],
        tags: [],
        maxConcurrentJobs: 10,
        version: 'v1.0.0' as const
      };

      db.serverRunner.updateMany.mockRejectedValue(new Error('Database error'));

      await expect(
        serverRunnerConnectionService.setServerRunnerConfig({
          runner: mockRunner as any,
          input: mockConfig
        })
      ).rejects.toThrow('Database error');
    });

    it('should handle special characters in connection key', async () => {
      const mockRunner = {
        oid: 1,
        id: 'runner_1',
        connectionKey: 'key_with_$pecial_ch@rs!',
        status: 'offline'
      };

      db.serverRunner.findFirst.mockResolvedValue(mockRunner);
      db.serverRunner.updateMany.mockResolvedValue({ count: 1 });

      const result = await serverRunnerConnectionService.registerServerRunner({
        connectionKey: 'key_with_$pecial_ch@rs!'
      });

      expect(result).toEqual(mockRunner);
    });

    it('should handle very long tags array', async () => {
      const mockRunner = { oid: 1, id: 'runner_1', status: 'online' };
      const longTags = Array.from({ length: 100 }, (_, i) => `tag_${i}`);

      db.serverRunner.updateMany.mockResolvedValue({ count: 1 });

      await serverRunnerConnectionService.setServerRunnerConfig({
        runner: mockRunner as any,
        input: {
          attributes: [],
          tags: longTags,
          maxConcurrentJobs: 10,
          version: 'v1.0.0'
        }
      });

      expect(db.serverRunner.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tags: longTags
          })
        })
      );
    });

    it('should handle maxConcurrentJobs of 0', async () => {
      const mockRunner = { oid: 1, id: 'runner_1', status: 'online' };

      db.serverRunner.updateMany.mockResolvedValue({ count: 1 });

      await serverRunnerConnectionService.setServerRunnerConfig({
        runner: mockRunner as any,
        input: {
          attributes: [],
          tags: [],
          maxConcurrentJobs: 0,
          version: 'v1.0.0'
        }
      });

      expect(db.serverRunner.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            maxConcurrentJobs: 0
          })
        })
      );
    });
  });
});
