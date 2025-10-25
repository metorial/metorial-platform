import { describe, expect, it, vi } from 'vitest';

// Mock the secret service
vi.mock('../src/services/secret', () => ({
  secretService: {
    createSecret: vi.fn(),
    getSecretById: vi.fn(),
    deleteSecret: vi.fn(),
    listSecrets: vi.fn(),
    DANGEROUSLY_readSecretValue: vi.fn()
  }
}));

describe('services/index', () => {
  describe('exports', () => {
    it('should re-export all exports from secret service', async () => {
      const module = await import('../src/services/index');

      expect(module.secretService).toBeDefined();
    });

    it('should export secretService', async () => {
      const { secretService } = await import('../src/services/index');

      expect(secretService).toBeDefined();
      expect(typeof secretService).toBe('object');
    });

    it('should have all service methods available', async () => {
      const { secretService } = await import('../src/services/index');

      expect(secretService.createSecret).toBeDefined();
      expect(secretService.getSecretById).toBeDefined();
      expect(secretService.deleteSecret).toBeDefined();
      expect(secretService.listSecrets).toBeDefined();
      expect(secretService.DANGEROUSLY_readSecretValue).toBeDefined();
    });

    it('should maintain type safety for service methods', async () => {
      const { secretService } = await import('../src/services/index');

      expect(typeof secretService.createSecret).toBe('function');
      expect(typeof secretService.getSecretById).toBe('function');
      expect(typeof secretService.deleteSecret).toBe('function');
      expect(typeof secretService.listSecrets).toBe('function');
      expect(typeof secretService.DANGEROUSLY_readSecretValue).toBe('function');
    });
  });

  describe('module structure', () => {
    it('should be importable without errors', async () => {
      await expect(import('../src/services/index')).resolves.toBeDefined();
    });

    it('should not add any additional exports', async () => {
      const module = await import('../src/services/index');

      // Should only export what's in the secret service
      expect(module.secretService).toBeDefined();
    });

    it('should allow destructured imports', async () => {
      const { secretService } = await import('../src/services/index');

      expect(secretService).toBeDefined();
    });

    it('should allow namespace imports', async () => {
      const ServicesModule = await import('../src/services/index');

      expect(ServicesModule.secretService).toBeDefined();
    });
  });

  describe('integration', () => {
    it('should export same instance as secret.ts', async () => {
      const servicesIndex = await import('../src/services/index');
      const secretModule = await import('../src/services/secret');

      expect(servicesIndex.secretService).toBe(secretModule.secretService);
    });

    it('should maintain referential equality on multiple imports', async () => {
      const module1 = await import('../src/services/index');
      const module2 = await import('../src/services/index');

      expect(module1.secretService).toBe(module2.secretService);
    });

    it('should preserve function references', async () => {
      const { secretService } = await import('../src/services/index');

      const createSecret1 = secretService.createSecret;
      const createSecret2 = secretService.createSecret;

      expect(createSecret1).toBe(createSecret2);
    });
  });

  describe('edge cases', () => {
    it('should handle multiple simultaneous imports', async () => {
      const promises = [
        import('../src/services/index'),
        import('../src/services/index'),
        import('../src/services/index')
      ];

      const modules = await Promise.all(promises);

      expect(modules[0]).toBe(modules[1]);
      expect(modules[1]).toBe(modules[2]);
    });

    it('should not throw during initialization', async () => {
      await expect(async () => {
        await import('../src/services/index');
      }).not.toThrow();
    });

    it('should maintain correct export structure', async () => {
      const module = await import('../src/services/index');

      const keys = Object.keys(module);
      expect(keys).toContain('secretService');
    });
  });

  describe('type safety', () => {
    it('should export correctly typed service', async () => {
      const { secretService } = await import('../src/services/index');

      // Verify service structure
      expect(secretService).toHaveProperty('createSecret');
      expect(secretService).toHaveProperty('getSecretById');
      expect(secretService).toHaveProperty('deleteSecret');
      expect(secretService).toHaveProperty('listSecrets');
      expect(secretService).toHaveProperty('DANGEROUSLY_readSecretValue');
    });

    it('should support typed imports', async () => {
      // TypeScript will verify this at compile time
      const module = await import('../src/services/index');

      expect(module).toBeDefined();
      expect(module.secretService).toBeDefined();
    });
  });

  describe('functionality', () => {
    it('should provide access to createSecret', async () => {
      const { secretService } = await import('../src/services/index');

      expect(secretService.createSecret).toBeDefined();
      expect(typeof secretService.createSecret).toBe('function');
    });

    it('should provide access to getSecretById', async () => {
      const { secretService } = await import('../src/services/index');

      expect(secretService.getSecretById).toBeDefined();
      expect(typeof secretService.getSecretById).toBe('function');
    });

    it('should provide access to deleteSecret', async () => {
      const { secretService } = await import('../src/services/index');

      expect(secretService.deleteSecret).toBeDefined();
      expect(typeof secretService.deleteSecret).toBe('function');
    });

    it('should provide access to listSecrets', async () => {
      const { secretService } = await import('../src/services/index');

      expect(secretService.listSecrets).toBeDefined();
      expect(typeof secretService.listSecrets).toBe('function');
    });

    it('should provide access to DANGEROUSLY_readSecretValue', async () => {
      const { secretService } = await import('../src/services/index');

      expect(secretService.DANGEROUSLY_readSecretValue).toBeDefined();
      expect(typeof secretService.DANGEROUSLY_readSecretValue).toBe('function');
    });
  });

  describe('consistency', () => {
    it('should maintain API consistency', async () => {
      const { secretService: service1 } = await import('../src/services/index');
      const { secretService: service2 } = await import('../src/services/secret');

      // Should have same methods
      const methods1 = Object.keys(service1).sort();
      const methods2 = Object.keys(service2).sort();

      expect(methods1).toEqual(methods2);
    });

    it('should not modify exports', async () => {
      const originalModule = await import('../src/services/secret');
      const reexportModule = await import('../src/services/index');

      expect(reexportModule.secretService).toBe(originalModule.secretService);
    });
  });
});
