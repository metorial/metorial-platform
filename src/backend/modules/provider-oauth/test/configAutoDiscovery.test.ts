import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockDbFindUnique = vi.fn();
const mockDbUpdate = vi.fn();
const mockAutoRegister = vi.fn();
const mockQueueAdd = vi.fn();
const mockQueueProcess = vi.fn((handler) => handler);
const mockCreateQueue = vi.fn(() => ({
  add: mockQueueAdd,
  process: mockQueueProcess
}));

vi.mock('@metorial/db', () => ({
  db: {
    providerOAuthConfig: {
      findUnique: mockDbFindUnique,
      update: mockDbUpdate
    }
  }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: mockCreateQueue,
  QueueRetryError: class QueueRetryError extends Error {}
}));

vi.mock('../src/services', () => ({
  providerOauthDiscoveryService: {
    autoRegisterForOauthConfig: mockAutoRegister
  }
}));

describe('queue/configAutoDiscovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('configAutoDiscoveryQueue', () => {
    it('should create queue with correct configuration', async () => {
      await import('../src/queue/configAutoDiscovery');

      expect(mockCreateQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'oat/confdiscau',
          workerOpts: expect.objectContaining({
            concurrency: 10,
            limiter: { max: 25, duration: 1000 }
          }),
          jobOpts: expect.objectContaining({
            attempts: 25,
            backoff: { type: 'exponential', delay: 1000 }
          })
        })
      );
    });

    it('should export configAutoDiscoveryQueue', async () => {
      const module = await import('../src/queue/configAutoDiscovery');
      expect(module.configAutoDiscoveryQueue).toBeDefined();
    });

    it('should export configAutoDiscoveryQueueProcessor', async () => {
      const module = await import('../src/queue/configAutoDiscovery');
      expect(module.configAutoDiscoveryQueueProcessor).toBeDefined();
    });
  });

  describe('configAutoDiscoveryQueueProcessor', () => {
    let processorFn: any;

    beforeEach(async () => {
      vi.resetModules();
      mockQueueProcess.mockImplementation((handler) => {
        processorFn = handler;
        return handler;
      });
      await import('../src/queue/configAutoDiscovery');
    });

    it('should throw QueueRetryError if config not found', async () => {
      mockDbFindUnique.mockResolvedValue(null);

      await expect(processorFn({ configId: 'test-id' })).rejects.toThrow();
    });

    it('should process json type config', async () => {
      const mockConfig = {
        id: 'test-id',
        type: 'json',
        config: { issuer: 'https://example.com' }
      };
      mockDbFindUnique.mockResolvedValue(mockConfig);
      mockAutoRegister.mockResolvedValue({ clientId: 'new-client' });

      await processorFn({ configId: 'test-id' });

      expect(mockAutoRegister).toHaveBeenCalledWith({
        config: mockConfig.config,
        clientName: 'Metorial Auto Discovery'
      });
    });

    it('should update config to supports_auto_registration when successful', async () => {
      const mockConfig = {
        id: 'test-id',
        type: 'json',
        config: { issuer: 'https://example.com' }
      };
      mockDbFindUnique.mockResolvedValue(mockConfig);
      mockAutoRegister.mockResolvedValue({ clientId: 'new-client' });

      await processorFn({ configId: 'test-id' });

      expect(mockDbUpdate).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: { discoverStatus: 'supports_auto_registration' }
      });
    });

    it('should update config to manual when auto registration fails', async () => {
      const mockConfig = {
        id: 'test-id',
        type: 'json',
        config: { issuer: 'https://example.com' }
      };
      mockDbFindUnique.mockResolvedValue(mockConfig);
      mockAutoRegister.mockResolvedValue(null);

      await processorFn({ configId: 'test-id' });

      expect(mockDbUpdate).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: { discoverStatus: 'manual' }
      });
    });

    it('should set status to manual for non-json type', async () => {
      const mockConfig = {
        id: 'test-id',
        type: 'managed_server_http',
        config: {}
      };
      mockDbFindUnique.mockResolvedValue(mockConfig);

      await processorFn({ configId: 'test-id' });

      expect(mockAutoRegister).not.toHaveBeenCalled();
      expect(mockDbUpdate).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: { discoverStatus: 'manual' }
      });
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
      await import('../src/queue/configAutoDiscovery');
    });

    it('should handle null config in autoRegister response', async () => {
      const mockConfig = {
        id: 'test-id',
        type: 'json',
        config: { issuer: 'https://example.com' }
      };
      mockDbFindUnique.mockResolvedValue(mockConfig);
      mockAutoRegister.mockResolvedValue(null);

      await processorFn({ configId: 'test-id' });

      expect(mockDbUpdate).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: { discoverStatus: 'manual' }
      });
    });

    it('should handle undefined autoRegister response', async () => {
      const mockConfig = {
        id: 'test-id',
        type: 'json',
        config: { issuer: 'https://example.com' }
      };
      mockDbFindUnique.mockResolvedValue(mockConfig);
      mockAutoRegister.mockResolvedValue(undefined);

      await processorFn({ configId: 'test-id' });

      expect(mockDbUpdate).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: { discoverStatus: 'manual' }
      });
    });

    it('should handle config with empty config object', async () => {
      const mockConfig = {
        id: 'test-id',
        type: 'json',
        config: {}
      };
      mockDbFindUnique.mockResolvedValue(mockConfig);
      mockAutoRegister.mockResolvedValue(null);

      await processorFn({ configId: 'test-id' });

      expect(mockAutoRegister).toHaveBeenCalledWith({
        config: {},
        clientName: 'Metorial Auto Discovery'
      });
    });

    it('should handle special characters in config id', async () => {
      const specialId = 'test-id-!@#$%';
      mockDbFindUnique.mockResolvedValue(null);

      await expect(processorFn({ configId: specialId })).rejects.toThrow();
      expect(mockDbFindUnique).toHaveBeenCalledWith({
        where: { id: specialId }
      });
    });

    it('should handle autoRegister with partial response', async () => {
      const mockConfig = {
        id: 'test-id',
        type: 'json',
        config: { issuer: 'https://example.com' }
      };
      mockDbFindUnique.mockResolvedValue(mockConfig);
      mockAutoRegister.mockResolvedValue({});

      await processorFn({ configId: 'test-id' });

      // Empty object is truthy, so it should be treated as successful
      expect(mockDbUpdate).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: { discoverStatus: 'supports_auto_registration' }
      });
    });

    it('should handle database update errors gracefully', async () => {
      const mockConfig = {
        id: 'test-id',
        type: 'json',
        config: { issuer: 'https://example.com' }
      };
      mockDbFindUnique.mockResolvedValue(mockConfig);
      mockAutoRegister.mockResolvedValue({ clientId: 'test' });
      mockDbUpdate.mockRejectedValue(new Error('Database error'));

      await expect(processorFn({ configId: 'test-id' })).rejects.toThrow('Database error');
    });

    it('should always use "Metorial Auto Discovery" as client name', async () => {
      const mockConfig = {
        id: 'test-id',
        type: 'json',
        config: { issuer: 'https://example.com' }
      };
      mockDbFindUnique.mockResolvedValue(mockConfig);
      mockAutoRegister.mockResolvedValue({ clientId: 'test' });

      await processorFn({ configId: 'test-id' });

      expect(mockAutoRegister).toHaveBeenCalledWith({
        config: mockConfig.config,
        clientName: 'Metorial Auto Discovery'
      });
    });
  });

  describe('queue configuration', () => {
    it('should have high concurrency for parallel processing', async () => {
      await import('../src/queue/configAutoDiscovery');

      expect(mockCreateQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          workerOpts: expect.objectContaining({
            concurrency: 10
          })
        })
      );
    });

    it('should have rate limiting configured', async () => {
      await import('../src/queue/configAutoDiscovery');

      expect(mockCreateQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          workerOpts: expect.objectContaining({
            limiter: { max: 25, duration: 1000 }
          })
        })
      );
    });

    it('should have retry configuration', async () => {
      await import('../src/queue/configAutoDiscovery');

      expect(mockCreateQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          jobOpts: expect.objectContaining({
            attempts: 25,
            backoff: { type: 'exponential', delay: 1000 }
          })
        })
      );
    });
  });
});
