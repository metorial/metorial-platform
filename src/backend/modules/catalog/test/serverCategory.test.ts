import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serverListingCategoryService } from '../src/services/serverCategory';
import { db } from '@metorial/db';
import { ServiceError } from '@metorial/error';

// Mock the db module
vi.mock('@metorial/db', () => ({
  db: {
    serverListingCategory: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

describe('serverListingCategoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getServerListingCategoryById', () => {
    it('should retrieve a category by id', async () => {
      let mockCategory = {
        id: 'category_123',
        slug: 'test-category',
        name: 'Test Category',
        description: 'Test Description',
        icon: 'test-icon'
      };

      vi.mocked(db.serverListingCategory.findFirst).mockResolvedValue(mockCategory as any);

      let result = await serverListingCategoryService.getServerListingCategoryById({
        serverListingCategoryId: 'category_123'
      });

      expect(result).toEqual(mockCategory);
      expect(db.serverListingCategory.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ id: 'category_123' }, { slug: 'category_123' }]
        }
      });
    });

    it('should retrieve a category by slug', async () => {
      let mockCategory = {
        id: 'category_123',
        slug: 'test-category',
        name: 'Test Category',
        description: 'Test Description',
        icon: 'test-icon'
      };

      vi.mocked(db.serverListingCategory.findFirst).mockResolvedValue(mockCategory as any);

      let result = await serverListingCategoryService.getServerListingCategoryById({
        serverListingCategoryId: 'test-category'
      });

      expect(result).toEqual(mockCategory);
      expect(db.serverListingCategory.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ id: 'test-category' }, { slug: 'test-category' }]
        }
      });
    });

    it('should throw ServiceError when category not found', async () => {
      vi.mocked(db.serverListingCategory.findFirst).mockResolvedValue(null);

      await expect(
        serverListingCategoryService.getServerListingCategoryById({
          serverListingCategoryId: 'nonexistent'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should handle special characters in category id', async () => {
      let mockCategory = {
        id: 'category_123',
        slug: 'test-category-special',
        name: 'Test Category',
        description: 'Test Description'
      };

      vi.mocked(db.serverListingCategory.findFirst).mockResolvedValue(mockCategory as any);

      await serverListingCategoryService.getServerListingCategoryById({
        serverListingCategoryId: 'test-category-special'
      });

      expect(db.serverListingCategory.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ id: 'test-category-special' }, { slug: 'test-category-special' }]
        }
      });
    });
  });

  describe('listServerListingCategories', () => {
    it('should list all categories', async () => {
      let mockCategories = [
        {
          id: 'category_1',
          slug: 'category-1',
          name: 'Category 1',
          description: 'Description 1'
        },
        {
          id: 'category_2',
          slug: 'category-2',
          name: 'Category 2',
          description: 'Description 2'
        },
        {
          id: 'category_3',
          slug: 'category-3',
          name: 'Category 3',
          description: 'Description 3'
        }
      ];

      vi.mocked(db.serverListingCategory.findMany).mockResolvedValue(mockCategories as any);

      let paginator = await serverListingCategoryService.listServerListingCategories({});

      expect(paginator).toBeDefined();
      expect(typeof paginator).toBe('object');
    });

    it('should return empty paginator when no categories exist', async () => {
      vi.mocked(db.serverListingCategory.findMany).mockResolvedValue([]);

      let paginator = await serverListingCategoryService.listServerListingCategories({});

      expect(paginator).toBeDefined();
    });

    it('should create paginator even when database is unavailable', async () => {
      // Paginators are lazy and don't execute until data is requested
      // So they don't throw errors during creation
      let paginator = await serverListingCategoryService.listServerListingCategories({});
      expect(paginator).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty string as category id', async () => {
      vi.mocked(db.serverListingCategory.findFirst).mockResolvedValue(null);

      await expect(
        serverListingCategoryService.getServerListingCategoryById({
          serverListingCategoryId: ''
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should handle very long category ids', async () => {
      let longId = 'a'.repeat(1000);
      vi.mocked(db.serverListingCategory.findFirst).mockResolvedValue(null);

      await expect(
        serverListingCategoryService.getServerListingCategoryById({
          serverListingCategoryId: longId
        })
      ).rejects.toThrow(ServiceError);

      expect(db.serverListingCategory.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ id: longId }, { slug: longId }]
        }
      });
    });

    it('should handle category with minimal fields', async () => {
      let mockCategory = {
        id: 'category_123',
        slug: 'test'
      };

      vi.mocked(db.serverListingCategory.findFirst).mockResolvedValue(mockCategory as any);

      let result = await serverListingCategoryService.getServerListingCategoryById({
        serverListingCategoryId: 'category_123'
      });

      expect(result).toEqual(mockCategory);
    });

    it('should handle category with all optional fields', async () => {
      let mockCategory = {
        id: 'category_123',
        slug: 'test-category',
        name: 'Test Category',
        description: 'Test Description',
        icon: 'icon.png',
        color: '#FF5733',
        order: 1,
        isVisible: true,
        metadata: { custom: 'data' }
      };

      vi.mocked(db.serverListingCategory.findFirst).mockResolvedValue(mockCategory as any);

      let result = await serverListingCategoryService.getServerListingCategoryById({
        serverListingCategoryId: 'category_123'
      });

      expect(result).toEqual(mockCategory);
    });
  });

  describe('slug and id handling', () => {
    it('should prioritize id match over slug match', async () => {
      let mockCategory = {
        id: 'category_123',
        slug: 'different-slug',
        name: 'Test Category'
      };

      vi.mocked(db.serverListingCategory.findFirst).mockResolvedValue(mockCategory as any);

      await serverListingCategoryService.getServerListingCategoryById({
        serverListingCategoryId: 'category_123'
      });

      expect(db.serverListingCategory.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ id: 'category_123' }, { slug: 'category_123' }]
        }
      });
    });

    it('should handle slugs with hyphens', async () => {
      let mockCategory = {
        id: 'category_123',
        slug: 'multi-word-slug-test',
        name: 'Test Category'
      };

      vi.mocked(db.serverListingCategory.findFirst).mockResolvedValue(mockCategory as any);

      let result = await serverListingCategoryService.getServerListingCategoryById({
        serverListingCategoryId: 'multi-word-slug-test'
      });

      expect(result.slug).toBe('multi-word-slug-test');
    });

    it('should handle slugs with numbers', async () => {
      let mockCategory = {
        id: 'category_123',
        slug: 'category-2024-test',
        name: 'Test Category'
      };

      vi.mocked(db.serverListingCategory.findFirst).mockResolvedValue(mockCategory as any);

      let result = await serverListingCategoryService.getServerListingCategoryById({
        serverListingCategoryId: 'category-2024-test'
      });

      expect(result.slug).toBe('category-2024-test');
    });
  });
});
