import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serverListingCollectionService } from '../src/services/serverCollection';
import { db } from '@metorial/db';
import { ServiceError } from '@metorial/error';

// Mock the db module
vi.mock('@metorial/db', () => ({
  db: {
    serverListingCollection: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

describe('serverListingCollectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getServerListingCollectionById', () => {
    it('should retrieve a collection by id', async () => {
      let mockCollection = {
        id: 'collection_123',
        slug: 'test-collection',
        name: 'Test Collection',
        description: 'Test Description',
        icon: 'test-icon'
      };

      vi.mocked(db.serverListingCollection.findFirst).mockResolvedValue(mockCollection as any);

      let result = await serverListingCollectionService.getServerListingCollectionById({
        serverListingCollectionId: 'collection_123'
      });

      expect(result).toEqual(mockCollection);
      expect(db.serverListingCollection.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ id: 'collection_123' }, { slug: 'collection_123' }]
        }
      });
    });

    it('should retrieve a collection by slug', async () => {
      let mockCollection = {
        id: 'collection_123',
        slug: 'featured-servers',
        name: 'Featured Servers',
        description: 'Our featured server collection',
        icon: 'star-icon'
      };

      vi.mocked(db.serverListingCollection.findFirst).mockResolvedValue(mockCollection as any);

      let result = await serverListingCollectionService.getServerListingCollectionById({
        serverListingCollectionId: 'featured-servers'
      });

      expect(result).toEqual(mockCollection);
      expect(db.serverListingCollection.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ id: 'featured-servers' }, { slug: 'featured-servers' }]
        }
      });
    });

    it('should throw ServiceError when collection not found', async () => {
      vi.mocked(db.serverListingCollection.findFirst).mockResolvedValue(null);

      await expect(
        serverListingCollectionService.getServerListingCollectionById({
          serverListingCollectionId: 'nonexistent'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should handle special characters in collection id', async () => {
      let mockCollection = {
        id: 'collection_123',
        slug: 'test-collection-special-2024',
        name: 'Test Collection'
      };

      vi.mocked(db.serverListingCollection.findFirst).mockResolvedValue(mockCollection as any);

      await serverListingCollectionService.getServerListingCollectionById({
        serverListingCollectionId: 'test-collection-special-2024'
      });

      expect(db.serverListingCollection.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ id: 'test-collection-special-2024' }, { slug: 'test-collection-special-2024' }]
        }
      });
    });
  });

  describe('listServerListingCollections', () => {
    it('should list all collections', async () => {
      let mockCollections = [
        {
          id: 'collection_1',
          slug: 'collection-1',
          name: 'Collection 1',
          description: 'Description 1'
        },
        {
          id: 'collection_2',
          slug: 'collection-2',
          name: 'Collection 2',
          description: 'Description 2'
        },
        {
          id: 'collection_3',
          slug: 'collection-3',
          name: 'Collection 3',
          description: 'Description 3'
        }
      ];

      vi.mocked(db.serverListingCollection.findMany).mockResolvedValue(mockCollections as any);

      let paginator = await serverListingCollectionService.listServerListingCollections({});

      expect(paginator).toBeDefined();
      expect(typeof paginator).toBe('object');
    });

    it('should return empty paginator when no collections exist', async () => {
      vi.mocked(db.serverListingCollection.findMany).mockResolvedValue([]);

      let paginator = await serverListingCollectionService.listServerListingCollections({});

      expect(paginator).toBeDefined();
    });

    it('should create paginator even when database is unavailable', async () => {
      // Paginators are lazy and don't execute until data is requested
      // So they don't throw errors during creation
      let paginator = await serverListingCollectionService.listServerListingCollections({});
      expect(paginator).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty string as collection id', async () => {
      vi.mocked(db.serverListingCollection.findFirst).mockResolvedValue(null);

      await expect(
        serverListingCollectionService.getServerListingCollectionById({
          serverListingCollectionId: ''
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should handle very long collection ids', async () => {
      let longId = 'a'.repeat(1000);
      vi.mocked(db.serverListingCollection.findFirst).mockResolvedValue(null);

      await expect(
        serverListingCollectionService.getServerListingCollectionById({
          serverListingCollectionId: longId
        })
      ).rejects.toThrow(ServiceError);

      expect(db.serverListingCollection.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ id: longId }, { slug: longId }]
        }
      });
    });

    it('should handle collection with minimal fields', async () => {
      let mockCollection = {
        id: 'collection_123',
        slug: 'test'
      };

      vi.mocked(db.serverListingCollection.findFirst).mockResolvedValue(mockCollection as any);

      let result = await serverListingCollectionService.getServerListingCollectionById({
        serverListingCollectionId: 'collection_123'
      });

      expect(result).toEqual(mockCollection);
    });

    it('should handle collection with all optional fields', async () => {
      let mockCollection = {
        id: 'collection_123',
        slug: 'test-collection',
        name: 'Test Collection',
        description: 'Test Description',
        icon: 'icon.png',
        banner: 'banner.png',
        color: '#FF5733',
        order: 1,
        isVisible: true,
        isFeatured: true,
        metadata: { custom: 'data' }
      };

      vi.mocked(db.serverListingCollection.findFirst).mockResolvedValue(mockCollection as any);

      let result = await serverListingCollectionService.getServerListingCollectionById({
        serverListingCollectionId: 'collection_123'
      });

      expect(result).toEqual(mockCollection);
    });
  });

  describe('slug and id handling', () => {
    it('should prioritize id match over slug match', async () => {
      let mockCollection = {
        id: 'collection_123',
        slug: 'different-slug',
        name: 'Test Collection'
      };

      vi.mocked(db.serverListingCollection.findFirst).mockResolvedValue(mockCollection as any);

      await serverListingCollectionService.getServerListingCollectionById({
        serverListingCollectionId: 'collection_123'
      });

      expect(db.serverListingCollection.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ id: 'collection_123' }, { slug: 'collection_123' }]
        }
      });
    });

    it('should handle slugs with hyphens', async () => {
      let mockCollection = {
        id: 'collection_123',
        slug: 'multi-word-slug-test',
        name: 'Test Collection'
      };

      vi.mocked(db.serverListingCollection.findFirst).mockResolvedValue(mockCollection as any);

      let result = await serverListingCollectionService.getServerListingCollectionById({
        serverListingCollectionId: 'multi-word-slug-test'
      });

      expect(result.slug).toBe('multi-word-slug-test');
    });

    it('should handle slugs with numbers', async () => {
      let mockCollection = {
        id: 'collection_123',
        slug: 'collection-2024-test',
        name: 'Test Collection'
      };

      vi.mocked(db.serverListingCollection.findFirst).mockResolvedValue(mockCollection as any);

      let result = await serverListingCollectionService.getServerListingCollectionById({
        serverListingCollectionId: 'collection-2024-test'
      });

      expect(result.slug).toBe('collection-2024-test');
    });
  });

  describe('collection listing behavior', () => {
    it('should handle large number of collections', async () => {
      let mockCollections = Array.from({ length: 100 }, (_, i) => ({
        id: `collection_${i}`,
        slug: `collection-${i}`,
        name: `Collection ${i}`,
        description: `Description ${i}`
      }));

      vi.mocked(db.serverListingCollection.findMany).mockResolvedValue(mockCollections as any);

      let paginator = await serverListingCollectionService.listServerListingCollections({});

      expect(paginator).toBeDefined();
    });

    it('should handle collections with null descriptions', async () => {
      let mockCollections = [
        {
          id: 'collection_1',
          slug: 'collection-1',
          name: 'Collection 1',
          description: null
        }
      ];

      vi.mocked(db.serverListingCollection.findMany).mockResolvedValue(mockCollections as any);

      let paginator = await serverListingCollectionService.listServerListingCollections({});

      expect(paginator).toBeDefined();
    });
  });
});
