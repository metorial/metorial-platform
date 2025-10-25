import { describe, expect, it, beforeEach, vi } from 'vitest';

// Mock the env module before importing meilisearch
vi.mock('../src/env', () => ({
  env: {
    meiliSearch: {
      MEILISEARCH_HOST: '',
      MEILISEARCH_API_KEY: ''
    }
  }
}));

describe('meilisearch', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('initialization without config', () => {
    it('should be undefined when MEILISEARCH_HOST is not set', async () => {
      vi.doMock('../src/env', () => ({
        env: {
          meiliSearch: {
            MEILISEARCH_HOST: '',
            MEILISEARCH_API_KEY: ''
          }
        }
      }));

      const { meiliSearch } = await import('../src/meilisearch');
      expect(meiliSearch).toBeUndefined();
    });

    it('should be undefined when MEILISEARCH_HOST is undefined', async () => {
      vi.doMock('../src/env', () => ({
        env: {
          meiliSearch: {
            MEILISEARCH_HOST: undefined,
            MEILISEARCH_API_KEY: undefined
          }
        }
      }));

      const { meiliSearch } = await import('../src/meilisearch');
      expect(meiliSearch).toBeUndefined();
    });
  });

  describe('initialization with config', () => {
    it('should create MeiliSearch instance when MEILISEARCH_HOST is set', async () => {
      vi.doMock('../src/env', () => ({
        env: {
          meiliSearch: {
            MEILISEARCH_HOST: 'http://localhost:7700',
            MEILISEARCH_API_KEY: 'test-key'
          }
        }
      }));

      const { meiliSearch } = await import('../src/meilisearch');
      expect(meiliSearch).toBeDefined();
      expect(meiliSearch).toHaveProperty('index');
      expect(typeof meiliSearch?.index).toBe('function');
    });

    it('should handle MEILISEARCH_HOST without API key', async () => {
      vi.doMock('../src/env', () => ({
        env: {
          meiliSearch: {
            MEILISEARCH_HOST: 'http://localhost:7700',
            MEILISEARCH_API_KEY: ''
          }
        }
      }));

      const { meiliSearch } = await import('../src/meilisearch');
      expect(meiliSearch).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle various host URL formats', async () => {
      const testCases = [
        'http://localhost:7700',
        'https://meilisearch.example.com',
        'http://127.0.0.1:7700',
        'https://search.domain.com:7700'
      ];

      for (const host of testCases) {
        vi.resetModules();
        vi.doMock('../src/env', () => ({
          env: {
            meiliSearch: {
              MEILISEARCH_HOST: host,
              MEILISEARCH_API_KEY: 'key'
            }
          }
        }));

        const { meiliSearch } = await import('../src/meilisearch');
        expect(meiliSearch).toBeDefined();
      }
    });

    it('should handle empty string API key', async () => {
      vi.doMock('../src/env', () => ({
        env: {
          meiliSearch: {
            MEILISEARCH_HOST: 'http://localhost:7700',
            MEILISEARCH_API_KEY: ''
          }
        }
      }));

      const { meiliSearch } = await import('../src/meilisearch');
      expect(meiliSearch).toBeDefined();
    });

    it('should be undefined with falsy MEILISEARCH_HOST values', async () => {
      const falsyValues = ['', null, undefined, 0, false];

      for (const falsyValue of falsyValues) {
        vi.resetModules();
        vi.doMock('../src/env', () => ({
          env: {
            meiliSearch: {
              MEILISEARCH_HOST: falsyValue,
              MEILISEARCH_API_KEY: 'key'
            }
          }
        }));

        const { meiliSearch } = await import('../src/meilisearch');
        expect(meiliSearch).toBeUndefined();
      }
    });
  });

  describe('MeiliSearch instance properties', () => {
    it('should have expected MeiliSearch methods when initialized', async () => {
      vi.doMock('../src/env', () => ({
        env: {
          meiliSearch: {
            MEILISEARCH_HOST: 'http://localhost:7700',
            MEILISEARCH_API_KEY: 'master-key'
          }
        }
      }));

      const { meiliSearch } = await import('../src/meilisearch');
      expect(meiliSearch).toBeDefined();

      if (meiliSearch) {
        expect(meiliSearch).toHaveProperty('index');
        expect(meiliSearch).toHaveProperty('getIndex');
        expect(meiliSearch).toHaveProperty('getIndexes');
        expect(meiliSearch).toHaveProperty('health');
        expect(meiliSearch).toHaveProperty('isHealthy');
      }
    });
  });
});
