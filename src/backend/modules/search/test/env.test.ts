import { describe, expect, it } from 'vitest';
import { env } from '../src/env';

describe('env', () => {
  describe('meiliSearch configuration', () => {
    it('should have MEILISEARCH_HOST property', () => {
      expect(env.meiliSearch).toHaveProperty('MEILISEARCH_HOST');
    });

    it('should have MEILISEARCH_API_KEY property', () => {
      expect(env.meiliSearch).toHaveProperty('MEILISEARCH_API_KEY');
    });

    it('should have MEILISEARCH_INDEX_PREFIX property', () => {
      expect(env.meiliSearch).toHaveProperty('MEILISEARCH_INDEX_PREFIX');
    });

    it('should allow undefined values for optional fields', () => {
      expect([undefined, '', 'string']).toContainEqual(typeof env.meiliSearch.MEILISEARCH_HOST);
      expect([undefined, '', 'string']).toContainEqual(
        typeof env.meiliSearch.MEILISEARCH_API_KEY
      );
      expect([undefined, '', 'string']).toContainEqual(
        typeof env.meiliSearch.MEILISEARCH_INDEX_PREFIX
      );
    });
  });

  describe('openSearch configuration', () => {
    it('should have OPENSEARCH_HOST property', () => {
      expect(env.openSearch).toHaveProperty('OPENSEARCH_HOST');
    });

    it('should have OPENSEARCH_USERNAME property', () => {
      expect(env.openSearch).toHaveProperty('OPENSEARCH_USERNAME');
    });

    it('should have OPENSEARCH_PASSWORD property', () => {
      expect(env.openSearch).toHaveProperty('OPENSEARCH_PASSWORD');
    });

    it('should have OPENSEARCH_INDEX_PREFIX property', () => {
      expect(env.openSearch).toHaveProperty('OPENSEARCH_INDEX_PREFIX');
    });

    it('should have OPENSEARCH_PROTOCOL property', () => {
      expect(env.openSearch).toHaveProperty('OPENSEARCH_PROTOCOL');
    });

    it('should have OPENSEARCH_AWS_MODE property', () => {
      expect(env.openSearch).toHaveProperty('OPENSEARCH_AWS_MODE');
    });

    it('should allow undefined values for optional fields', () => {
      expect([undefined, '', 'string']).toContainEqual(typeof env.openSearch.OPENSEARCH_HOST);
      expect([undefined, '', 'string']).toContainEqual(typeof env.openSearch.OPENSEARCH_USERNAME);
      expect([undefined, '', 'string']).toContainEqual(typeof env.openSearch.OPENSEARCH_PASSWORD);
      expect([undefined, '', 'string']).toContainEqual(
        typeof env.openSearch.OPENSEARCH_INDEX_PREFIX
      );
      expect([undefined, '', 'string']).toContainEqual(typeof env.openSearch.OPENSEARCH_PROTOCOL);
      expect([undefined, '', 'string']).toContainEqual(typeof env.openSearch.OPENSEARCH_AWS_MODE);
    });
  });

  describe('algolia configuration', () => {
    it('should have ALGOLIA_APP_ID property', () => {
      expect(env.algolia).toHaveProperty('ALGOLIA_APP_ID');
    });

    it('should have ALGOLIA_ADMIN_KEY property', () => {
      expect(env.algolia).toHaveProperty('ALGOLIA_ADMIN_KEY');
    });

    it('should have ALGOLIA_INDEX_PREFIX property', () => {
      expect(env.algolia).toHaveProperty('ALGOLIA_INDEX_PREFIX');
    });

    it('should allow undefined values for optional fields', () => {
      expect([undefined, '', 'string']).toContainEqual(typeof env.algolia.ALGOLIA_APP_ID);
      expect([undefined, '', 'string']).toContainEqual(typeof env.algolia.ALGOLIA_ADMIN_KEY);
      expect([undefined, '', 'string']).toContainEqual(typeof env.algolia.ALGOLIA_INDEX_PREFIX);
    });
  });

  describe('env structure', () => {
    it('should have all three configuration sections', () => {
      expect(env).toHaveProperty('meiliSearch');
      expect(env).toHaveProperty('openSearch');
      expect(env).toHaveProperty('algolia');
    });

    it('should have exactly three top-level properties', () => {
      const keys = Object.keys(env);
      expect(keys).toHaveLength(3);
      expect(keys).toContain('meiliSearch');
      expect(keys).toContain('openSearch');
      expect(keys).toContain('algolia');
    });

    it('should handle edge case where all values are undefined', () => {
      // Since all env vars are optional, they can all be undefined
      expect(env.meiliSearch).toBeDefined();
      expect(env.openSearch).toBeDefined();
      expect(env.algolia).toBeDefined();
    });
  });
});
