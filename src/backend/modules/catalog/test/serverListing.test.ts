import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serverListingService } from '../src/services/serverListing';
import { db, withTransaction, ID } from '@metorial/db';
import { ServiceError } from '@metorial/error';
import { searchService } from '@metorial/module-search';

// Mock dependencies
vi.mock('@metorial/db', () => ({
  db: {
    serverListing: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn()
    },
    serverListingCollection: {
      findMany: vi.fn()
    },
    serverListingCategory: {
      findMany: vi.fn()
    },
    profile: {
      findMany: vi.fn()
    },
    serverVariantProvider: {
      findMany: vi.fn()
    },
    serverListingUpdate: {
      create: vi.fn()
    }
  },
  withTransaction: vi.fn(),
  ID: {
    generateId: vi.fn()
  }
}));

vi.mock('@metorial/module-search', () => ({
  searchService: {
    search: vi.fn()
  }
}));

vi.mock('../queues/customListing', () => ({
  setCustomServerListingQueue: {
    add: vi.fn()
  }
}));

vi.mock('../queues/search', () => ({
  indexServerListingQueue: {
    add: vi.fn()
  }
}));

vi.mock('@metorial/config', () => ({
  config: {
    redis: {
      url: 'redis://localhost:6379'
    }
  },
  getConfig: vi.fn(() => ({
    redisUrl: 'redis://localhost:6379'
  }))
}));

describe('serverListingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getServerListingById', () => {
    it('should retrieve a server listing by id', async () => {
      let mockServerListing = {
        id: 'listing_123',
        slug: 'test-listing',
        name: 'Test Listing',
        description: 'Test Description',
        isPublic: true,
        status: 'active',
        categories: [],
        profile: null,
        server: {
          id: 'server_123',
          importedServer: null,
          customServer: null
        }
      };

      vi.mocked(db.serverListing.findFirst).mockResolvedValue(mockServerListing as any);

      let result = await serverListingService.getServerListingById({
        serverListingId: 'listing_123'
      });

      expect(result).toEqual(mockServerListing);
      expect(db.serverListing.findFirst).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              OR: [
                { id: 'listing_123' },
                { slug: 'listing_123' },
                { server: { id: 'listing_123' } }
              ]
            },
            {
              OR: [{ isPublic: true }]
            }
          ]
        },
        include: expect.any(Object)
      });
    });

    it('should retrieve a server listing by slug', async () => {
      let mockServerListing = {
        id: 'listing_123',
        slug: 'test-listing',
        name: 'Test Listing',
        isPublic: true,
        status: 'active',
        categories: [],
        profile: null,
        server: {
          id: 'server_123'
        }
      };

      vi.mocked(db.serverListing.findFirst).mockResolvedValue(mockServerListing as any);

      await serverListingService.getServerListingById({
        serverListingId: 'test-listing'
      });

      expect(db.serverListing.findFirst).toHaveBeenCalled();
    });

    it('should retrieve a server listing with instance context', async () => {
      let mockInstance = {
        id: 'instance_123',
        oid: 1,
        organizationOid: 100
      };

      let mockServerListing = {
        id: 'listing_123',
        slug: 'test-listing',
        name: 'Test Listing',
        isPublic: false,
        ownerOrganizationOid: 100,
        status: 'active',
        categories: [],
        profile: null,
        server: {
          id: 'server_123',
          instanceServers: [
            {
              instanceOid: 1,
              instance: mockInstance
            }
          ]
        }
      };

      vi.mocked(db.serverListing.findFirst).mockResolvedValue(mockServerListing as any);

      let result = await serverListingService.getServerListingById({
        serverListingId: 'listing_123',
        instance: mockInstance as any
      });

      expect(result).toEqual(mockServerListing);
      expect(db.serverListing.findFirst).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              OR: [
                { id: 'listing_123' },
                { slug: 'listing_123' },
                { server: { id: 'listing_123' } }
              ]
            },
            {
              OR: [{ ownerOrganizationOid: 100 }, { isPublic: true }]
            }
          ]
        },
        include: expect.any(Object)
      });
    });

    it('should throw ServiceError when server listing not found', async () => {
      vi.mocked(db.serverListing.findFirst).mockResolvedValue(null);

      await expect(
        serverListingService.getServerListingById({ serverListingId: 'nonexistent' })
      ).rejects.toThrow(ServiceError);
    });

    it('should retrieve by server id', async () => {
      let mockServerListing = {
        id: 'listing_123',
        slug: 'test-listing',
        name: 'Test Listing',
        isPublic: true,
        status: 'active',
        categories: [],
        profile: null,
        server: {
          id: 'server_123'
        }
      };

      vi.mocked(db.serverListing.findFirst).mockResolvedValue(mockServerListing as any);

      await serverListingService.getServerListingById({
        serverListingId: 'server_123'
      });

      expect(db.serverListing.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([{ server: { id: 'server_123' } }])
              })
            ])
          })
        })
      );
    });
  });

  // Note: updateServerListing and setServerListing methods use queues which require Redis
  // These are tested through integration tests rather than unit tests

  describe('listServerListings', () => {
    it('should list all active server listings', async () => {
      let mockListings = [
        {
          id: 'listing_1',
          slug: 'listing-1',
          status: 'active',
          name: 'Listing 1',
          isPublic: true
        },
        {
          id: 'listing_2',
          slug: 'listing-2',
          status: 'active',
          name: 'Listing 2',
          isPublic: true
        }
      ];

      vi.mocked(db.serverListing.findMany).mockResolvedValue(mockListings as any);

      let paginator = await serverListingService.listServerListings({});

      expect(paginator).toBeDefined();
    });

    it('should filter by collections', async () => {
      let mockCollections = [
        { id: 'col_1', oid: 1, slug: 'collection-1' },
        { id: 'col_2', oid: 2, slug: 'collection-2' }
      ];

      vi.mocked(db.serverListingCollection.findMany).mockResolvedValue(mockCollections as any);
      vi.mocked(db.serverListing.findMany).mockResolvedValue([]);

      await serverListingService.listServerListings({
        collectionIds: ['col_1', 'col_2']
      });

      expect(db.serverListingCollection.findMany).toHaveBeenCalledWith({
        where: { OR: [{ id: { in: ['col_1', 'col_2'] } }, { slug: { in: ['col_1', 'col_2'] } }] }
      });
    });

    it('should filter by categories', async () => {
      let mockCategories = [
        { id: 'cat_1', oid: 1, slug: 'category-1' },
        { id: 'cat_2', oid: 2, slug: 'category-2' }
      ];

      vi.mocked(db.serverListingCategory.findMany).mockResolvedValue(mockCategories as any);
      vi.mocked(db.serverListing.findMany).mockResolvedValue([]);

      await serverListingService.listServerListings({
        categoryIds: ['cat_1', 'cat_2']
      });

      expect(db.serverListingCategory.findMany).toHaveBeenCalledWith({
        where: { OR: [{ id: { in: ['cat_1', 'cat_2'] } }, { slug: { in: ['cat_1', 'cat_2'] } }] }
      });
    });

    it('should filter by profiles', async () => {
      let mockProfiles = [
        { id: 'prof_1', slug: 'profile-1' },
        { id: 'prof_2', slug: 'profile-2' }
      ];

      vi.mocked(db.profile.findMany).mockResolvedValue(mockProfiles as any);
      vi.mocked(db.serverListing.findMany).mockResolvedValue([]);

      await serverListingService.listServerListings({
        profileIds: ['prof_1', 'prof_2']
      });

      expect(db.profile.findMany).toHaveBeenCalledWith({
        where: { OR: [{ id: { in: ['prof_1', 'prof_2'] } }, { slug: { in: ['prof_1', 'prof_2'] } }] }
      });
    });

    it('should filter by providers', async () => {
      let mockProviders = [
        { id: 'prov_1', oid: 1, identifier: 'provider-1' },
        { id: 'prov_2', oid: 2, identifier: 'provider-2' }
      ];

      vi.mocked(db.serverVariantProvider.findMany).mockResolvedValue(mockProviders as any);
      vi.mocked(db.serverListing.findMany).mockResolvedValue([]);

      await serverListingService.listServerListings({
        providerIds: ['prov_1', 'prov_2']
      });

      expect(db.serverVariantProvider.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ id: { in: ['prov_1', 'prov_2'] } }, { identifier: { in: ['prov_1', 'prov_2'] } }]
        }
      });
    });

    it('should create paginator with search filter', async () => {
      let mockSearchResults = [{ id: 'listing_1' }, { id: 'listing_2' }];

      vi.mocked(searchService.search).mockResolvedValue(mockSearchResults as any);
      vi.mocked(db.serverListing.findMany).mockResolvedValue([]);

      let paginator = await serverListingService.listServerListings({
        search: 'test query'
      });

      // Paginators are lazy - they won't call search until data is requested
      expect(paginator).toBeDefined();
    });

    it('should trim and ignore empty search queries', async () => {
      vi.mocked(db.serverListing.findMany).mockResolvedValue([]);

      await serverListingService.listServerListings({
        search: '   '
      });

      expect(searchService.search).not.toHaveBeenCalled();
    });

    it('should create paginator with isPublic filter', async () => {
      vi.mocked(db.serverListing.findMany).mockResolvedValue([]);

      let paginator = await serverListingService.listServerListings({
        isPublic: true
      });

      expect(paginator).toBeDefined();
    });

    it('should create paginator with isVerified filter', async () => {
      vi.mocked(db.serverListing.findMany).mockResolvedValue([]);

      let paginator = await serverListingService.listServerListings({
        isVerified: true
      });

      expect(paginator).toBeDefined();
    });

    it('should create paginator with isOfficial filter', async () => {
      vi.mocked(db.serverListing.findMany).mockResolvedValue([]);

      let paginator = await serverListingService.listServerListings({
        isOfficial: true
      });

      expect(paginator).toBeDefined();
    });

    it('should create paginator with isMetorial filter', async () => {
      vi.mocked(db.serverListing.findMany).mockResolvedValue([]);

      let paginator = await serverListingService.listServerListings({
        isMetorial: true
      });

      expect(paginator).toBeDefined();
    });

    it('should create paginator with isHostable filter', async () => {
      vi.mocked(db.serverListing.findMany).mockResolvedValue([]);

      let paginator = await serverListingService.listServerListings({
        isHostable: true
      });

      expect(paginator).toBeDefined();
    });

    it('should create paginator with instance organization filter', async () => {
      let mockInstance = {
        id: 'instance_123',
        oid: 1,
        organizationOid: 100
      };

      vi.mocked(db.serverListing.findMany).mockResolvedValue([]);

      let paginator = await serverListingService.listServerListings({
        instance: mockInstance as any
      });

      expect(paginator).toBeDefined();
    });

    it('should create paginator with orderByRank', async () => {
      vi.mocked(db.serverListing.findMany).mockResolvedValue([]);

      let paginator = await serverListingService.listServerListings({
        orderByRank: true
      });

      expect(paginator).toBeDefined();
    });

    it('should create paginator with onlyFromOrganization filter', async () => {
      let mockInstance = {
        id: 'instance_123',
        oid: 1,
        organizationOid: 100
      };

      vi.mocked(db.serverListing.findMany).mockResolvedValue([]);

      let paginator = await serverListingService.listServerListings({
        instance: mockInstance as any,
        onlyFromOrganization: true
      });

      expect(paginator).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty arrays for filter parameters', async () => {
      vi.mocked(db.serverListing.findMany).mockResolvedValue([]);

      await serverListingService.listServerListings({
        collectionIds: [],
        categoryIds: [],
        profileIds: [],
        providerIds: []
      });

      expect(db.serverListingCollection.findMany).not.toHaveBeenCalled();
      expect(db.serverListingCategory.findMany).not.toHaveBeenCalled();
      expect(db.profile.findMany).not.toHaveBeenCalled();
      expect(db.serverVariantProvider.findMany).not.toHaveBeenCalled();
    });

    it('should create paginator with multiple filters', async () => {
      let mockCategories = [{ id: 'cat_1', oid: 1, slug: 'category-1' }];
      let mockCollections = [{ id: 'col_1', oid: 1, slug: 'collection-1' }];
      let mockSearchResults = [{ id: 'listing_1' }];

      vi.mocked(db.serverListingCategory.findMany).mockResolvedValue(mockCategories as any);
      vi.mocked(db.serverListingCollection.findMany).mockResolvedValue(mockCollections as any);
      vi.mocked(searchService.search).mockResolvedValue(mockSearchResults as any);
      vi.mocked(db.serverListing.findMany).mockResolvedValue([]);

      let paginator = await serverListingService.listServerListings({
        search: 'test',
        categoryIds: ['cat_1'],
        collectionIds: ['col_1'],
        isPublic: true,
        isVerified: true,
        orderByRank: true
      });

      expect(paginator).toBeDefined();
      // Verify that pre-filtering happened
      expect(db.serverListingCategory.findMany).toHaveBeenCalled();
      expect(db.serverListingCollection.findMany).toHaveBeenCalled();
    });

    it('should create paginator with undefined instance', async () => {
      vi.mocked(db.serverListing.findMany).mockResolvedValue([]);

      let paginator = await serverListingService.listServerListings({
        instance: undefined
      });

      expect(paginator).toBeDefined();
    });
  });
});
