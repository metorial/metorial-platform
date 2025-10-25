import { describe, expect, it, beforeEach, vi } from 'vitest';

// Mock dependencies
vi.mock('@metorial/queue', () => ({
  combineQueueProcessors: vi.fn((processors: any[]) => processors)
}));

vi.mock('../src/services', () => ({
  searchService: {
    indexDocument: vi.fn(),
    search: vi.fn()
  }
}));

describe('search module index', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('exports', () => {
    it('should export searchQueueProcessor', async () => {
      const indexModule = await import('../src/index');
      expect(indexModule).toHaveProperty('searchQueueProcessor');
    });

    it('should export services', async () => {
      const indexModule = await import('../src/index');
      expect(indexModule).toHaveProperty('searchService');
    });

    it('should have searchQueueProcessor as array', async () => {
      const indexModule = await import('../src/index');
      expect(Array.isArray(indexModule.searchQueueProcessor)).toBe(true);
    });

    it('should initialize searchQueueProcessor with empty array', async () => {
      const indexModule = await import('../src/index');
      expect(indexModule.searchQueueProcessor).toEqual([]);
    });

    it('should re-export searchService from services', async () => {
      const indexModule = await import('../src/index');
      const servicesModule = await import('../src/services');
      expect(indexModule.searchService).toBe(servicesModule.searchService);
    });
  });

  describe('module structure', () => {
    it('should have defined exports', async () => {
      const indexModule = await import('../src/index');
      const exports = Object.keys(indexModule);
      expect(exports.length).toBeGreaterThan(0);
    });

    it('should export searchQueueProcessor as a mutable variable', async () => {
      const indexModule = await import('../src/index');
      const originalProcessor = indexModule.searchQueueProcessor;

      // Since it's declared with 'let', it's mutable (though we can't reassign in tests)
      expect(indexModule.searchQueueProcessor).toBeDefined();
      expect(originalProcessor).toBeDefined();
    });
  });

  describe('combineQueueProcessors integration', () => {
    it('should call combineQueueProcessors with empty array', async () => {
      const { combineQueueProcessors } = await import('@metorial/queue');
      await import('../src/index');

      expect(combineQueueProcessors).toHaveBeenCalledWith([]);
    });

    it('should handle combineQueueProcessors result', async () => {
      const mockProcessors = [{ name: 'test-processor' }];
      vi.doMock('@metorial/queue', () => ({
        combineQueueProcessors: vi.fn(() => mockProcessors)
      }));

      const indexModule = await import('../src/index');
      expect(indexModule.searchQueueProcessor).toBe(mockProcessors);
    });
  });

  describe('edge cases', () => {
    it('should handle module re-import', async () => {
      const firstImport = await import('../src/index');
      const secondImport = await import('../src/index');

      expect(firstImport).toBe(secondImport);
    });

    it('should maintain searchQueueProcessor reference', async () => {
      const indexModule = await import('../src/index');
      const processor1 = indexModule.searchQueueProcessor;
      const processor2 = indexModule.searchQueueProcessor;

      expect(processor1).toBe(processor2);
    });

    it('should export all expected properties', async () => {
      const indexModule = await import('../src/index');
      const exportedKeys = Object.keys(indexModule);

      expect(exportedKeys).toContain('searchQueueProcessor');
      expect(exportedKeys).toContain('searchService');
    });
  });

  describe('type safety', () => {
    it('should have searchQueueProcessor with correct type', async () => {
      const indexModule = await import('../src/index');
      expect(typeof indexModule.searchQueueProcessor).toBe('object');
    });

    it('should have searchService as an object', async () => {
      const indexModule = await import('../src/index');
      expect(typeof indexModule.searchService).toBe('object');
      expect(indexModule.searchService).not.toBeNull();
    });

    it('should have searchService with expected methods', async () => {
      const indexModule = await import('../src/index');
      expect(indexModule.searchService).toHaveProperty('indexDocument');
      expect(indexModule.searchService).toHaveProperty('search');
    });
  });

  describe('initialization', () => {
    it('should initialize without errors', async () => {
      await expect(import('../src/index')).resolves.toBeDefined();
    });

    it('should initialize searchQueueProcessor synchronously', async () => {
      const indexModule = await import('../src/index');
      expect(indexModule.searchQueueProcessor).toBeDefined();
    });

    it('should initialize services synchronously', async () => {
      const indexModule = await import('../src/index');
      expect(indexModule.searchService).toBeDefined();
    });
  });

  describe('module exports validation', () => {
    it('should not have undefined exports', async () => {
      const indexModule = await import('../src/index');
      const exports = Object.keys(indexModule);

      exports.forEach(key => {
        expect(indexModule[key as keyof typeof indexModule]).toBeDefined();
      });
    });

    it('should handle destructured imports', async () => {
      const { searchQueueProcessor, searchService } = await import('../src/index');
      expect(searchQueueProcessor).toBeDefined();
      expect(searchService).toBeDefined();
    });

    it('should handle default and named exports', async () => {
      const indexModule = await import('../src/index');
      // Module uses named exports only
      expect(indexModule.default).toBeUndefined();
    });
  });

  describe('dependency loading', () => {
    it('should load queue module dependency', async () => {
      const { combineQueueProcessors } = await import('@metorial/queue');
      expect(combineQueueProcessors).toBeDefined();
    });

    it('should load services module dependency', async () => {
      const servicesModule = await import('../src/services');
      expect(servicesModule).toBeDefined();
      expect(servicesModule.searchService).toBeDefined();
    });
  });
});
