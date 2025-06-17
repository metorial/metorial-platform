import { db } from '@metorial/db';
import { ServiceError } from '@metorial/error';
import { searchService } from '@metorial/module-search';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serverListingService } from '../src/services/serverListing';

vi.mock('@metorial/db', () => ({
  db: {
    serverListing: {
      findFirst: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn()
    },
    serverListingCollection: { findMany: vi.fn() },
    serverListingCategory: { findMany: vi.fn() },
    profile: { findMany: vi.fn() },
    serverVariantProvider: { findMany: vi.fn() }
  }
}));
vi.mock('@metorial/module-search', () => ({
  searchService: { search: vi.fn() }
}));
vi.mock('@metorial/pagination', () => ({
  Paginator: {
    create: (fn: any) => fn({ prisma: (cb: any) => cb({ take: 10, orderBy: undefined }) })
  }
}));

describe('serverListingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getServerListingById', () => {
    it('returns server listing by id', async () => {
      const mockListing = { id: '1', name: 'Test' };
      (db.serverListing.findFirst as any).mockResolvedValue(mockListing);

      const result = await serverListingService.getServerListingById({ serverListingId: '1' });
      expect(result).toBe(mockListing);
      expect(db.serverListing.findFirst).toHaveBeenCalled();
    });

    it('throws ServiceError if not found', async () => {
      (db.serverListing.findFirst as any).mockResolvedValue(undefined);

      await expect(
        serverListingService.getServerListingById({ serverListingId: 'notfound' })
      ).rejects.toBeInstanceOf(ServiceError);
    });
  });

  describe('ADMIN_updateServerListing', () => {
    it('updates and returns server listing', async () => {
      const mockListing = { id: '1', name: 'Updated' };
      (db.serverListing.update as any).mockResolvedValue(mockListing);

      const result = await serverListingService.ADMIN_updateServerListing({
        serverListing: { id: '1' } as any,
        input: { name: 'Updated' }
      });
      expect(result).toBe(mockListing);
      expect(db.serverListing.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: '1' } })
      );
    });
  });

  describe('listServerListings', () => {
    it('returns paginated server listings with no filters', async () => {
      (db.serverListing.findMany as any).mockResolvedValue([{ id: '1' }]);
      const result = await serverListingService.listServerListings({});
      expect(Array.isArray(result)).toBe(true);
      expect(db.serverListing.findMany).toHaveBeenCalled();
    });

    it('applies search filter', async () => {
      (searchService.search as any).mockResolvedValue([{ id: 'search-id' }]);
      (db.serverListing.findMany as any).mockResolvedValue([{ id: 'search-id' }]);
      const result: any = await serverListingService.listServerListings({ search: 'test' });
      expect(result[0].id).toBe('search-id');
      expect(searchService.search).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'test' })
      );
    });

    it('applies collection, category, profile, provider, and instance filters', async () => {
      (db.serverListingCollection.findMany as any).mockResolvedValue([{ oid: 'col1' }]);
      (db.serverListingCategory.findMany as any).mockResolvedValue([{ oid: 'cat1' }]);
      (db.profile.findMany as any).mockResolvedValue([{ id: 'prof1' }]);
      (db.serverVariantProvider.findMany as any).mockResolvedValue([{ oid: 'prov1' }]);
      (db.serverListing.findMany as any).mockResolvedValue([{ id: '1' }]);

      const result = await serverListingService.listServerListings({
        collectionIds: ['col1'],
        categoryIds: ['cat1'],
        profileIds: ['prof1'],
        providerIds: ['prov1'],
        instance: { oid: 'inst1' } as any
      });
      expect(Array.isArray(result)).toBe(true);
      expect(db.serverListing.findMany).toHaveBeenCalled();
    });

    it('orders by rank if orderByRank is true', async () => {
      (db.serverListing.findMany as any).mockResolvedValue([{ id: '1' }]);
      await serverListingService.listServerListings({ orderByRank: true });
      expect(db.serverListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { rank: 'desc' } })
      );
    });
  });
});
