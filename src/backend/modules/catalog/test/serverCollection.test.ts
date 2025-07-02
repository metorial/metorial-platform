import { db } from '@metorial/db';
import { ServiceError } from '@metorial/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serverListingCollectionService } from '../src/services/serverCollection';

vi.mock('@metorial/db', () => ({
  db: {
    serverListingCollection: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    }
  }
}));
vi.mock('@metorial/pagination', () => ({
  Paginator: {
    create: vi.fn(fn => fn({ prisma: (cb: any) => cb({}) }))
  }
}));
vi.mock('@metorial/service', () => ({
  Service: {
    create: vi.fn((_name: string, factory: any) => ({
      build: () => factory()
    }))
  }
}));
vi.mock('@metorial/error', () => ({
  notFoundError: (type: string, id: string) => ({ type, id }),
  ServiceError: class extends Error {
    constructor(public error: any) {
      super('ServiceError');
    }
  }
}));

describe('serverListingCollectionService', () => {
  const mockCollection = { id: '1', slug: 'slug-1' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getServerListingCollectionById', () => {
    it('returns collection by id', async () => {
      (db.serverListingCollection.findFirst as any).mockResolvedValueOnce(mockCollection);
      const result = await serverListingCollectionService.getServerListingCollectionById({
        serverListingCollectionId: '1'
      });
      expect(result).toBe(mockCollection);
      expect(db.serverListingCollection.findFirst).toHaveBeenCalledWith({
        where: { OR: [{ id: '1' }, { slug: '1' }] }
      });
    });

    it('throws ServiceError if not found', async () => {
      (db.serverListingCollection.findFirst as any).mockResolvedValueOnce(null);
      await expect(
        serverListingCollectionService.getServerListingCollectionById({
          serverListingCollectionId: 'notfound'
        })
      ).rejects.toBeInstanceOf(ServiceError);
    });
  });

  describe('listServerListingCollections', () => {
    it('calls Paginator.create and returns result', async () => {
      const mockResult = [{ id: '1' }, { id: '2' }];
      (db.serverListingCollection.findMany as any).mockResolvedValueOnce(mockResult);
      const paginator = await serverListingCollectionService.listServerListingCollections({});
      expect(Array.isArray(paginator)).toBe(true);
      expect(paginator).toEqual(mockResult);
    });
  });
});
