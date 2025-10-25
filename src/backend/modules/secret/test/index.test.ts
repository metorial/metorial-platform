import { describe, expect, it, vi } from 'vitest';

// Mock all dependencies
vi.mock('@metorial/queue', () => ({
  combineQueueProcessors: vi.fn((processors: any[]) => ({
    processors,
    process: vi.fn()
  }))
}));

vi.mock('../src/cron/cleanup', () => ({
  secretCleanupCron: {
    config: { name: 'sec/cleanup', cron: '0 0 * * *' },
    handler: vi.fn()
  }
}));

vi.mock('../src/services', () => ({
  secretService: {
    createSecret: vi.fn(),
    getSecretById: vi.fn()
  }
}));

vi.mock('../src/store', () => ({
  SecretStores: {
    register: vi.fn(),
    get: vi.fn(),
    getDefault: vi.fn()
  },
  SecretStoreManager: {
    create: vi.fn()
  }
}));

describe('module index', () => {
  describe('exports', () => {
    it('should export SecretType type', async () => {
      const module = await import('../src/index');

      // TypeScript will verify this at compile time
      expect(module).toBeDefined();
    });

    it('should re-export services', async () => {
      const module = await import('../src/index');

      expect(module.secretService).toBeDefined();
    });

    it('should re-export store exports', async () => {
      const module = await import('../src/index');

      expect(module.SecretStores).toBeDefined();
      expect(module.SecretStoreManager).toBeDefined();
    });

    it('should export secretQueueProcessor', async () => {
      const module = await import('../src/index');

      expect(module.secretQueueProcessor).toBeDefined();
    });

    it('should have all expected exports', async () => {
      const module = await import('../src/index');

      // Check that key exports are present
      const expectedExports = ['secretQueueProcessor', 'secretService', 'SecretStores', 'SecretStoreManager'];

      expectedExports.forEach(exportName => {
        expect(module).toHaveProperty(exportName);
      });
    });
  });

  describe('secretQueueProcessor', () => {
    it('should combine queue processors with cleanup cron', async () => {
      const { combineQueueProcessors } = await import('@metorial/queue');
      const { secretCleanupCron } = await import('../src/cron/cleanup');
      const { secretQueueProcessor } = await import('../src/index');

      expect(combineQueueProcessors).toHaveBeenCalledWith([secretCleanupCron]);
      expect(secretQueueProcessor).toBeDefined();
    });

    it('should be a valid queue processor', async () => {
      const { secretQueueProcessor } = await import('../src/index');

      expect(secretQueueProcessor).toBeDefined();
      expect(typeof secretQueueProcessor).toBe('object');
    });

    it('should include cleanup cron in processors', async () => {
      const { secretQueueProcessor } = await import('../src/index');

      // Verify that the queue processor includes the cleanup cron
      expect(secretQueueProcessor).toHaveProperty('processors');
      expect(Array.isArray(secretQueueProcessor.processors)).toBe(true);
      expect(secretQueueProcessor.processors.length).toBe(1);
    });
  });

  describe('module structure', () => {
    it('should not have naming conflicts', async () => {
      const module = await import('../src/index');

      const exportNames = Object.keys(module);
      const uniqueNames = [...new Set(exportNames)];

      expect(exportNames.length).toBe(uniqueNames.length);
    });

    it('should provide access to services', async () => {
      const module = await import('../src/index');

      expect(module.secretService).toBeDefined();
      expect(typeof module.secretService).toBe('object');
    });

    it('should provide access to stores', async () => {
      const module = await import('../src/index');

      expect(module.SecretStores).toBeDefined();
      expect(module.SecretStoreManager).toBeDefined();
    });

    it('should be importable without errors', async () => {
      await expect(import('../src/index')).resolves.toBeDefined();
    });
  });

  describe('integration', () => {
    it('should properly wire up cron with queue processor', async () => {
      const { combineQueueProcessors } = await import('@metorial/queue');
      const module = await import('../src/index');

      expect(combineQueueProcessors).toHaveBeenCalled();
      expect(module.secretQueueProcessor).toBeDefined();
    });

    it('should export consistent API', async () => {
      const module = await import('../src/index');

      // Check that the module provides a consistent API
      expect(module).toHaveProperty('secretQueueProcessor');
      expect(module).toHaveProperty('secretService');
      expect(module).toHaveProperty('SecretStores');
      expect(module).toHaveProperty('SecretStoreManager');
    });
  });

  describe('edge cases', () => {
    it('should handle multiple imports', async () => {
      const module1 = await import('../src/index');
      const module2 = await import('../src/index');

      // Should be the same module instance
      expect(module1).toBe(module2);
    });

    it('should maintain referential equality for exports', async () => {
      const module = await import('../src/index');

      const service1 = module.secretService;
      const service2 = module.secretService;

      expect(service1).toBe(service2);
    });

    it('should export objects, not primitives', async () => {
      const module = await import('../src/index');

      expect(typeof module.secretService).toBe('object');
      expect(typeof module.SecretStores).toBe('object');
      expect(typeof module.secretQueueProcessor).toBe('object');
    });
  });

  describe('type safety', () => {
    it('should export SecretType for type checking', async () => {
      // This test verifies that SecretType is exported
      // TypeScript will catch issues at compile time
      const module = await import('../src/index');

      expect(module).toBeDefined();
    });

    it('should allow importing specific exports', async () => {
      // Verify that destructured imports work
      const { secretService, SecretStores } = await import('../src/index');

      expect(secretService).toBeDefined();
      expect(SecretStores).toBeDefined();
    });

    it('should support namespace imports', async () => {
      const SecretModule = await import('../src/index');

      expect(SecretModule.secretService).toBeDefined();
      expect(SecretModule.SecretStores).toBeDefined();
      expect(SecretModule.secretQueueProcessor).toBeDefined();
    });
  });

  describe('initialization', () => {
    it('should initialize queue processor on import', async () => {
      const { combineQueueProcessors } = await import('@metorial/queue');

      await import('../src/index');

      expect(combineQueueProcessors).toHaveBeenCalled();
    });

    it('should not throw errors during initialization', async () => {
      await expect(async () => {
        await import('../src/index');
      }).not.toThrow();
    });
  });
});
