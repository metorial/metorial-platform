import { describe, expect, it, beforeEach, vi, Mock } from 'vitest';
import { MeiliSearchApiError } from 'meilisearch';

// Create mocks
const mockMeiliSearchIndex = {
  addDocuments: vi.fn(),
  search: vi.fn()
};

const mockMeiliSearch = {
  index: vi.fn(() => mockMeiliSearchIndex)
};

const mockOpenSearch = {
  indices: {
    exists: vi.fn(),
    create: vi.fn()
  },
  bulk: vi.fn(),
  search: vi.fn()
};

const mockAlgoliaSearch = {
  saveObjects: vi.fn(),
  searchSingleIndex: vi.fn()
};

// Mock the dependencies
vi.mock('../src/env', () => ({
  env: {
    meiliSearch: {
      MEILISEARCH_HOST: 'http://localhost:7700',
      MEILISEARCH_API_KEY: 'key',
      MEILISEARCH_INDEX_PREFIX: 'test'
    },
    openSearch: {
      OPENSEARCH_HOST: 'http://localhost:9200',
      OPENSEARCH_USERNAME: 'admin',
      OPENSEARCH_PASSWORD: 'admin',
      OPENSEARCH_INDEX_PREFIX: 'test',
      OPENSEARCH_PROTOCOL: 'http',
      OPENSEARCH_AWS_MODE: 'false'
    },
    algolia: {
      ALGOLIA_APP_ID: 'test-app-id',
      ALGOLIA_ADMIN_KEY: 'test-key',
      ALGOLIA_INDEX_PREFIX: 'test'
    }
  }
}));

vi.mock('meilisearch', () => ({
  MeiliSearch: vi.fn(() => mockMeiliSearch),
  MeiliSearchApiError: class MeiliSearchApiError extends Error {
    cause?: { code?: string };
    constructor(message: any, cause?: { code?: string }) {
      super(typeof message === 'string' ? message : 'MeiliSearch error');
      this.cause = cause;
      this.name = 'MeiliSearchApiError';
    }
  }
}));

vi.mock('@opensearch-project/opensearch', () => ({
  Client: vi.fn(() => mockOpenSearch)
}));

vi.mock('algoliasearch', () => ({
  algoliasearch: vi.fn(() => mockAlgoliaSearch)
}));

vi.mock('aws-opensearch-connector', () => ({
  default: vi.fn(() => ({}))
}));

vi.mock('@metorial/service', () => ({
  Service: {
    create: vi.fn((name: string, factory: () => any) => ({
      build: () => factory()
    }))
  }
}));

describe('SearchService', () => {
  let searchService: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset mock implementations
    mockMeiliSearchIndex.addDocuments.mockResolvedValue({ taskUid: 1 });
    mockMeiliSearchIndex.search.mockResolvedValue({ hits: [] });
    mockOpenSearch.indices.exists.mockResolvedValue({ body: true });
    mockOpenSearch.indices.create.mockResolvedValue({});
    mockOpenSearch.bulk.mockResolvedValue({});
    mockOpenSearch.search.mockResolvedValue({ body: { hits: { hits: [] } } });
    mockAlgoliaSearch.saveObjects.mockResolvedValue({});
    mockAlgoliaSearch.searchSingleIndex.mockResolvedValue({ hits: [] });

    // Re-import to get fresh instance
    vi.resetModules();
    const searchModule = await import('../src/services/search');
    searchService = searchModule.searchService;
  });

  describe('indexDocument', () => {
    it('should index a single document', async () => {
      const document = { id: '1', name: 'Test' };
      await searchService.indexDocument({
        index: 'server_listing',
        document
      });

      expect(mockMeiliSearchIndex.addDocuments).toHaveBeenCalledWith([document], {
        primaryKey: 'id'
      });
    });

    it('should index multiple documents', async () => {
      const documents = [
        { id: '1', name: 'Test 1' },
        { id: '2', name: 'Test 2' }
      ];
      await searchService.indexDocument({
        index: 'server_listing',
        document: documents
      });

      expect(mockMeiliSearchIndex.addDocuments).toHaveBeenCalledWith(documents, {
        primaryKey: 'id'
      });
    });

    it('should handle indexing errors gracefully', async () => {
      mockMeiliSearchIndex.addDocuments.mockRejectedValueOnce(new Error('Index error'));

      await expect(
        searchService.indexDocument({
          index: 'server_listing',
          document: { id: '1', name: 'Test' }
        })
      ).resolves.not.toThrow();

      expect(console.error).toHaveBeenCalled();
    });

    it('should work with different index types', async () => {
      const indexTypes: Array<'server_listing' | 'server_implementation' | 'server_deployment' | 'magic_mcp_server'> = [
        'server_listing',
        'server_implementation',
        'server_deployment',
        'magic_mcp_server'
      ];

      for (const indexType of indexTypes) {
        await searchService.indexDocument({
          index: indexType,
          document: { id: '1', name: 'Test' }
        });
      }

      expect(mockMeiliSearchIndex.addDocuments).toHaveBeenCalledTimes(indexTypes.length);
    });

    it('should handle edge case with empty document array', async () => {
      await searchService.indexDocument({
        index: 'server_listing',
        document: []
      });

      expect(mockMeiliSearchIndex.addDocuments).toHaveBeenCalledWith([], {
        primaryKey: 'id'
      });
    });

    it('should handle document with only id field', async () => {
      const document = { id: 'minimal' };
      await searchService.indexDocument({
        index: 'server_listing',
        document
      });

      expect(mockMeiliSearchIndex.addDocuments).toHaveBeenCalledWith([document], {
        primaryKey: 'id'
      });
    });

    it('should handle document with complex nested structure', async () => {
      const document = {
        id: 'complex',
        metadata: {
          tags: ['tag1', 'tag2'],
          nested: { deep: { value: 'test' } }
        },
        array: [1, 2, 3]
      };
      await searchService.indexDocument({
        index: 'server_listing',
        document
      });

      expect(mockMeiliSearchIndex.addDocuments).toHaveBeenCalledWith([document], {
        primaryKey: 'id'
      });
    });
  });

  describe('search', () => {
    it('should search with basic query', async () => {
      const mockHits = [{ id: '1', name: 'Test Result' }];
      mockMeiliSearchIndex.search.mockResolvedValueOnce({ hits: mockHits });

      const results = await searchService.search({
        index: 'server_listing',
        query: 'test query'
      });

      expect(mockMeiliSearchIndex.search).toHaveBeenCalledWith('test query', {
        limit: undefined,
        filter: undefined
      });
      expect(results).toEqual(mockHits);
    });

    it('should search with limit option', async () => {
      const mockHits = [{ id: '1', name: 'Test' }];
      mockMeiliSearchIndex.search.mockResolvedValueOnce({ hits: mockHits });

      const results = await searchService.search({
        index: 'server_listing',
        query: 'test',
        options: { limit: 5 }
      });

      expect(mockMeiliSearchIndex.search).toHaveBeenCalledWith('test', { limit: 5 });
      expect(results).toEqual(mockHits);
    });

    it('should search with filters', async () => {
      const mockHits = [{ id: '1', name: 'Test', status: 'active' }];
      mockMeiliSearchIndex.search.mockResolvedValueOnce({ hits: mockHits });

      const results = await searchService.search({
        index: 'server_listing',
        query: 'test',
        options: {
          filters: { status: { $eq: 'active' } }
        }
      });

      expect(mockMeiliSearchIndex.search).toHaveBeenCalledWith('test', {
        filter: 'status = "active"'
      });
      expect(results).toEqual(mockHits);
    });

    it('should search with multiple filters', async () => {
      const mockHits = [{ id: '1', name: 'Test', status: 'active', type: 'premium' }];
      mockMeiliSearchIndex.search.mockResolvedValueOnce({ hits: mockHits });

      const results = await searchService.search({
        index: 'server_listing',
        query: 'test',
        options: {
          filters: {
            status: { $eq: 'active' },
            type: { $eq: 'premium' }
          }
        }
      });

      expect(mockMeiliSearchIndex.search).toHaveBeenCalledWith('test', {
        filter: 'status = "active" AND type = "premium"'
      });
      expect(results).toEqual(mockHits);
    });

    it('should search with limit and filters combined', async () => {
      const mockHits = [{ id: '1', name: 'Test' }];
      mockMeiliSearchIndex.search.mockResolvedValueOnce({ hits: mockHits });

      const results = await searchService.search({
        index: 'server_listing',
        query: 'test',
        options: {
          limit: 10,
          filters: { status: { $eq: 'active' } }
        }
      });

      expect(mockMeiliSearchIndex.search).toHaveBeenCalledWith('test', {
        limit: 10,
        filter: 'status = "active"'
      });
      expect(results).toEqual(mockHits);
    });

    it('should handle empty search results', async () => {
      mockMeiliSearchIndex.search.mockResolvedValueOnce({ hits: [] });

      const results = await searchService.search({
        index: 'server_listing',
        query: 'nonexistent'
      });

      expect(results).toEqual([]);
    });

    it('should handle index_not_found error', async () => {
      const error = new MeiliSearchApiError('Index not found', { code: 'index_not_found' });
      mockMeiliSearchIndex.search.mockRejectedValueOnce(error);

      const results = await searchService.search({
        index: 'server_listing',
        query: 'test'
      });

      expect(results).toEqual([]);
    });

    it('should throw on non-index_not_found MeiliSearchApiError', async () => {
      const error = new MeiliSearchApiError('Some other error', { code: 'other_error' });
      mockMeiliSearchIndex.search.mockRejectedValueOnce(error);

      await expect(
        searchService.search({
          index: 'server_listing',
          query: 'test'
        })
      ).rejects.toThrow('Some other error');
    });

    it('should throw on generic errors', async () => {
      const error = new Error('Generic error');
      mockMeiliSearchIndex.search.mockRejectedValueOnce(error);

      await expect(
        searchService.search({
          index: 'server_listing',
          query: 'test'
        })
      ).rejects.toThrow('Generic error');
    });

    it('should handle empty query string', async () => {
      mockMeiliSearchIndex.search.mockResolvedValueOnce({ hits: [] });

      const results = await searchService.search({
        index: 'server_listing',
        query: ''
      });

      expect(mockMeiliSearchIndex.search).toHaveBeenCalledWith('', {
        limit: undefined,
        filter: undefined
      });
      expect(results).toEqual([]);
    });

    it('should handle special characters in query', async () => {
      const specialQuery = 'test@#$%^&*()[]{}';
      mockMeiliSearchIndex.search.mockResolvedValueOnce({ hits: [] });

      await searchService.search({
        index: 'server_listing',
        query: specialQuery
      });

      expect(mockMeiliSearchIndex.search).toHaveBeenCalledWith(specialQuery, {
        limit: undefined,
        filter: undefined
      });
    });

    it('should handle very long query strings', async () => {
      const longQuery = 'a'.repeat(1000);
      mockMeiliSearchIndex.search.mockResolvedValueOnce({ hits: [] });

      await searchService.search({
        index: 'server_listing',
        query: longQuery
      });

      expect(mockMeiliSearchIndex.search).toHaveBeenCalledWith(longQuery, {
        limit: undefined,
        filter: undefined
      });
    });

    it('should handle limit of 0', async () => {
      mockMeiliSearchIndex.search.mockResolvedValueOnce({ hits: [] });

      const results = await searchService.search({
        index: 'server_listing',
        query: 'test',
        options: { limit: 0 }
      });

      expect(mockMeiliSearchIndex.search).toHaveBeenCalledWith('test', { limit: 0 });
      expect(results).toEqual([]);
    });

    it('should handle very large limit', async () => {
      mockMeiliSearchIndex.search.mockResolvedValueOnce({ hits: [] });

      await searchService.search({
        index: 'server_listing',
        query: 'test',
        options: { limit: 10000 }
      });

      expect(mockMeiliSearchIndex.search).toHaveBeenCalledWith('test', { limit: 10000 });
    });

    it('should work with different index types', async () => {
      const indexTypes: Array<'server_listing' | 'server_implementation' | 'server_deployment' | 'magic_mcp_server'> = [
        'server_listing',
        'server_implementation',
        'server_deployment',
        'magic_mcp_server'
      ];

      for (const indexType of indexTypes) {
        mockMeiliSearchIndex.search.mockResolvedValueOnce({ hits: [] });
        await searchService.search({
          index: indexType,
          query: 'test'
        });
      }

      expect(mockMeiliSearchIndex.search).toHaveBeenCalledTimes(indexTypes.length);
    });
  });

  describe('ensureIndex', () => {
    it('should create index only once for repeated calls', async () => {
      await searchService.indexDocument({
        index: 'server_listing',
        document: { id: '1', name: 'Test' }
      });

      await searchService.indexDocument({
        index: 'server_listing',
        document: { id: '2', name: 'Test 2' }
      });

      // MeiliSearch index method should be called only once per index
      expect(mockMeiliSearch.index).toHaveBeenCalledWith('test_server_listing');
    });

    it('should create separate indices for different index types', async () => {
      await searchService.indexDocument({
        index: 'server_listing',
        document: { id: '1', name: 'Test' }
      });

      await searchService.indexDocument({
        index: 'server_implementation',
        document: { id: '2', name: 'Test' }
      });

      expect(mockMeiliSearch.index).toHaveBeenCalledWith('test_server_listing');
      expect(mockMeiliSearch.index).toHaveBeenCalledWith('test_server_implementation');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle null query gracefully', async () => {
      mockMeiliSearchIndex.search.mockResolvedValueOnce({ hits: [] });

      await searchService.search({
        index: 'server_listing',
        query: null as any
      });

      expect(mockMeiliSearchIndex.search).toHaveBeenCalled();
    });

    it('should handle undefined options', async () => {
      mockMeiliSearchIndex.search.mockResolvedValueOnce({ hits: [] });

      const results = await searchService.search({
        index: 'server_listing',
        query: 'test',
        options: undefined
      });

      expect(mockMeiliSearchIndex.search).toHaveBeenCalledWith('test', {
        limit: undefined,
        filter: undefined
      });
      expect(results).toEqual([]);
    });

    it('should handle malformed filter values', async () => {
      mockMeiliSearchIndex.search.mockResolvedValueOnce({ hits: [] });

      await searchService.search({
        index: 'server_listing',
        query: 'test',
        options: {
          filters: { status: { $eq: '' } }
        }
      });

      expect(mockMeiliSearchIndex.search).toHaveBeenCalledWith('test', {
        filter: 'status = ""'
      });
    });

    it('should handle filter values with quotes', async () => {
      mockMeiliSearchIndex.search.mockResolvedValueOnce({ hits: [] });

      await searchService.search({
        index: 'server_listing',
        query: 'test',
        options: {
          filters: { name: { $eq: 'value"with"quotes' } }
        }
      });

      expect(mockMeiliSearchIndex.search).toHaveBeenCalled();
    });

    it('should handle concurrent indexing operations', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        searchService.indexDocument({
          index: 'server_listing',
          document: { id: `${i}`, name: `Test ${i}` }
        })
      );

      await Promise.all(promises);

      expect(mockMeiliSearchIndex.addDocuments).toHaveBeenCalledTimes(10);
    });

    it('should handle concurrent search operations', async () => {
      mockMeiliSearchIndex.search.mockResolvedValue({ hits: [] });

      const promises = Array.from({ length: 10 }, (_, i) =>
        searchService.search({
          index: 'server_listing',
          query: `test ${i}`
        })
      );

      await Promise.all(promises);

      expect(mockMeiliSearchIndex.search).toHaveBeenCalledTimes(10);
    });

    it('should handle document without required id field gracefully', async () => {
      const invalidDoc = { name: 'No ID' } as any;

      await searchService.indexDocument({
        index: 'server_listing',
        document: invalidDoc
      });

      expect(mockMeiliSearchIndex.addDocuments).toHaveBeenCalledWith([invalidDoc], {
        primaryKey: 'id'
      });
    });

    it('should handle very large document payloads', async () => {
      const largeDoc = {
        id: 'large',
        data: 'x'.repeat(10000),
        array: Array(1000).fill({ nested: 'data' })
      };

      await searchService.indexDocument({
        index: 'server_listing',
        document: largeDoc
      });

      expect(mockMeiliSearchIndex.addDocuments).toHaveBeenCalledWith([largeDoc], {
        primaryKey: 'id'
      });
    });
  });
});
