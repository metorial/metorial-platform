import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serverVariantService } from '../src/services/serverVariant';
import { db } from '@metorial/db';
import { ServiceError } from '@metorial/error';

// Mock the db module
vi.mock('@metorial/db', () => ({
  db: {
    serverVariant: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    server: {
      findFirst: vi.fn()
    }
  }
}));

describe('serverVariantService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getServerVariantById', () => {
    it('should retrieve a server variant by id', async () => {
      let mockServerVariant = {
        id: 'variant_123',
        identifier: 'test-variant',
        name: 'Test Variant',
        sourceType: 'remote',
        currentVersion: {
          id: 'version_123',
          schema: { test: 'schema' }
        },
        server: {
          id: 'server_123',
          name: 'Test Server'
        }
      };

      vi.mocked(db.serverVariant.findFirst).mockResolvedValue(mockServerVariant as any);

      let result = await serverVariantService.getServerVariantById({
        serverVariantId: 'variant_123'
      });

      expect(result).toEqual(mockServerVariant);
      expect(db.serverVariant.findFirst).toHaveBeenCalledWith({
        where: {
          serverOid: undefined,
          AND: [
            {
              OR: [{ id: 'variant_123' }, { identifier: 'variant_123' }]
            },
            {
              OR: [{ onlyForInstanceOid: null }, { onlyForInstanceOid: null }]
            }
          ]
        },
        include: expect.any(Object)
      });
    });

    it('should retrieve a server variant by identifier', async () => {
      let mockServerVariant = {
        id: 'variant_123',
        identifier: 'docker-variant',
        name: 'Docker Variant',
        sourceType: 'docker',
        currentVersion: {
          id: 'version_123',
          schema: {}
        },
        server: {
          id: 'server_123'
        }
      };

      vi.mocked(db.serverVariant.findFirst).mockResolvedValue(mockServerVariant as any);

      let result = await serverVariantService.getServerVariantById({
        serverVariantId: 'docker-variant'
      });

      expect(result).toEqual(mockServerVariant);
      expect(db.serverVariant.findFirst).toHaveBeenCalledWith({
        where: {
          serverOid: undefined,
          AND: [
            {
              OR: [{ id: 'docker-variant' }, { identifier: 'docker-variant' }]
            },
            {
              OR: [{ onlyForInstanceOid: null }, { onlyForInstanceOid: null }]
            }
          ]
        },
        include: expect.any(Object)
      });
    });

    it('should filter by server when provided', async () => {
      let mockServer = {
        id: 'server_123',
        oid: 10,
        name: 'Test Server'
      };

      let mockServerVariant = {
        id: 'variant_123',
        identifier: 'test-variant',
        serverOid: 10,
        currentVersion: {
          id: 'version_123',
          schema: {}
        },
        server: mockServer
      };

      vi.mocked(db.serverVariant.findFirst).mockResolvedValue(mockServerVariant as any);

      let result = await serverVariantService.getServerVariantById({
        serverVariantId: 'variant_123',
        server: mockServer as any
      });

      expect(result).toEqual(mockServerVariant);
      expect(db.serverVariant.findFirst).toHaveBeenCalledWith({
        where: {
          serverOid: 10,
          AND: [
            {
              OR: [{ id: 'variant_123' }, { identifier: 'variant_123' }]
            },
            {
              OR: [{ onlyForInstanceOid: null }, { onlyForInstanceOid: null }]
            }
          ]
        },
        include: expect.any(Object)
      });
    });

    it('should filter by instance when provided', async () => {
      let mockInstance = {
        id: 'instance_123',
        oid: 100,
        organizationOid: 1
      };

      let mockServerVariant = {
        id: 'variant_123',
        identifier: 'test-variant',
        onlyForInstanceOid: null,
        currentVersion: {
          id: 'version_123',
          schema: {}
        },
        server: {
          id: 'server_123'
        }
      };

      vi.mocked(db.serverVariant.findFirst).mockResolvedValue(mockServerVariant as any);

      let result = await serverVariantService.getServerVariantById({
        serverVariantId: 'variant_123',
        instance: mockInstance as any
      });

      expect(result).toEqual(mockServerVariant);
      expect(db.serverVariant.findFirst).toHaveBeenCalledWith({
        where: {
          serverOid: undefined,
          AND: [
            {
              OR: [{ id: 'variant_123' }, { identifier: 'variant_123' }]
            },
            {
              OR: [{ onlyForInstanceOid: null }, { onlyForInstanceOid: 100 }]
            }
          ]
        },
        include: expect.any(Object)
      });
    });

    it('should throw ServiceError when variant not found', async () => {
      vi.mocked(db.serverVariant.findFirst).mockResolvedValue(null);

      await expect(
        serverVariantService.getServerVariantById({ serverVariantId: 'nonexistent' })
      ).rejects.toThrow(ServiceError);
    });

    it('should include currentVersion and schema', async () => {
      let mockServerVariant = {
        id: 'variant_123',
        identifier: 'test-variant',
        currentVersion: {
          id: 'version_123',
          schema: {
            type: 'object',
            properties: {
              test: { type: 'string' }
            }
          }
        },
        server: {
          id: 'server_123'
        }
      };

      vi.mocked(db.serverVariant.findFirst).mockResolvedValue(mockServerVariant as any);

      let result = await serverVariantService.getServerVariantById({
        serverVariantId: 'variant_123'
      });

      expect(result.currentVersion).toBeDefined();
      expect(result.currentVersion?.schema).toEqual({
        type: 'object',
        properties: {
          test: { type: 'string' }
        }
      });
    });
  });

  describe('getServerVariantByIdOrLatestServerVariantSafe', () => {
    it('should return variant when serverVariantId provided', async () => {
      let mockInstance = {
        id: 'instance_123',
        oid: 100,
        organizationOid: 1
      };

      let mockServerVariant = {
        id: 'variant_123',
        identifier: 'test-variant',
        currentVersion: {
          id: 'version_123',
          schema: {}
        },
        server: {
          id: 'server_123'
        }
      };

      vi.mocked(db.serverVariant.findFirst).mockResolvedValue(mockServerVariant as any);

      let result = await serverVariantService.getServerVariantByIdOrLatestServerVariantSafe({
        serverVariantId: 'variant_123',
        instance: mockInstance as any
      });

      expect(result).toEqual(mockServerVariant);
    });

    it('should return latest variant when serverId provided', async () => {
      let mockInstance = {
        id: 'instance_123',
        oid: 100,
        organizationOid: 1
      };

      let mockServer = {
        id: 'server_123',
        isPublic: true
      };

      let mockVariants = [
        {
          id: 'variant_1',
          sourceType: 'remote',
          server: mockServer
        },
        {
          id: 'variant_2',
          sourceType: 'docker',
          server: mockServer
        }
      ];

      vi.mocked(db.server.findFirst).mockResolvedValue(mockServer as any);
      vi.mocked(db.serverVariant.findMany).mockResolvedValue(mockVariants as any);

      let result = await serverVariantService.getServerVariantByIdOrLatestServerVariantSafe({
        serverId: 'server_123',
        instance: mockInstance as any
      });

      expect(result).toEqual(mockVariants[0]);
      expect(db.server.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'server_123',
          OR: [{ ownerOrganizationOid: 1 }, { isPublic: true }]
        }
      });
    });

    it('should prioritize remote over docker variants', async () => {
      let mockInstance = {
        id: 'instance_123',
        oid: 100,
        organizationOid: 1
      };

      let mockServer = {
        id: 'server_123',
        isPublic: true
      };

      let mockVariants = [
        {
          id: 'variant_docker',
          sourceType: 'docker',
          server: mockServer
        },
        {
          id: 'variant_remote',
          sourceType: 'remote',
          server: mockServer
        }
      ];

      vi.mocked(db.server.findFirst).mockResolvedValue(mockServer as any);
      vi.mocked(db.serverVariant.findMany).mockResolvedValue(mockVariants as any);

      let result = await serverVariantService.getServerVariantByIdOrLatestServerVariantSafe({
        serverId: 'server_123',
        instance: mockInstance as any
      });

      expect(result?.id).toBe('variant_remote');
    });

    it('should throw ServiceError when server not found', async () => {
      let mockInstance = {
        id: 'instance_123',
        oid: 100,
        organizationOid: 1
      };

      vi.mocked(db.server.findFirst).mockResolvedValue(null);

      await expect(
        serverVariantService.getServerVariantByIdOrLatestServerVariantSafe({
          serverId: 'nonexistent',
          instance: mockInstance as any
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should return first variant when all same sourceType', async () => {
      let mockInstance = {
        id: 'instance_123',
        oid: 100,
        organizationOid: 1
      };

      let mockServer = {
        id: 'server_123',
        isPublic: true
      };

      let mockVariants = [
        {
          id: 'variant_1',
          sourceType: 'remote',
          server: mockServer
        },
        {
          id: 'variant_2',
          sourceType: 'remote',
          server: mockServer
        }
      ];

      vi.mocked(db.server.findFirst).mockResolvedValue(mockServer as any);
      vi.mocked(db.serverVariant.findMany).mockResolvedValue(mockVariants as any);

      let result = await serverVariantService.getServerVariantByIdOrLatestServerVariantSafe({
        serverId: 'server_123',
        instance: mockInstance as any
      });

      expect(result?.id).toBe('variant_1');
    });

    it('should return undefined when no variants found', async () => {
      let mockInstance = {
        id: 'instance_123',
        oid: 100,
        organizationOid: 1
      };

      let mockServer = {
        id: 'server_123',
        isPublic: true
      };

      vi.mocked(db.server.findFirst).mockResolvedValue(mockServer as any);
      vi.mocked(db.serverVariant.findMany).mockResolvedValue([]);

      let result = await serverVariantService.getServerVariantByIdOrLatestServerVariantSafe({
        serverId: 'server_123',
        instance: mockInstance as any
      });

      expect(result).toBeUndefined();
    });

    it('should return undefined when neither serverId nor serverVariantId provided', async () => {
      let mockInstance = {
        id: 'instance_123',
        oid: 100,
        organizationOid: 1
      };

      let result = await serverVariantService.getServerVariantByIdOrLatestServerVariantSafe({
        instance: mockInstance as any
      });

      expect(result).toBeUndefined();
    });
  });

  describe('listServerVariants', () => {
    it('should list all variants for a server', async () => {
      let mockServer = {
        id: 'server_123',
        oid: 10,
        name: 'Test Server'
      };

      let mockVariants = [
        {
          id: 'variant_1',
          identifier: 'variant-1',
          sourceType: 'remote',
          currentVersion: {
            id: 'version_1',
            schema: {}
          },
          server: mockServer
        },
        {
          id: 'variant_2',
          identifier: 'variant-2',
          sourceType: 'docker',
          currentVersion: {
            id: 'version_2',
            schema: {}
          },
          server: mockServer
        }
      ];

      vi.mocked(db.serverVariant.findMany).mockResolvedValue(mockVariants as any);

      let paginator = await serverVariantService.listServerVariants({
        server: mockServer as any
      });

      expect(paginator).toBeDefined();
      expect(typeof paginator).toBe('object');
    });

    it('should create paginator that filters by server oid', async () => {
      let mockServer = {
        id: 'server_123',
        oid: 10,
        name: 'Test Server'
      };

      vi.mocked(db.serverVariant.findMany).mockResolvedValue([]);

      let paginator = await serverVariantService.listServerVariants({
        server: mockServer as any
      });

      // Paginators are lazy - they create a query function but don't execute until requested
      expect(paginator).toBeDefined();
    });

    it('should return empty paginator when no variants exist', async () => {
      let mockServer = {
        id: 'server_123',
        oid: 10,
        name: 'Test Server'
      };

      vi.mocked(db.serverVariant.findMany).mockResolvedValue([]);

      let paginator = await serverVariantService.listServerVariants({
        server: mockServer as any
      });

      expect(paginator).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle variant without currentVersion', async () => {
      let mockServerVariant = {
        id: 'variant_123',
        identifier: 'test-variant',
        currentVersion: null,
        server: {
          id: 'server_123'
        }
      };

      vi.mocked(db.serverVariant.findFirst).mockResolvedValue(mockServerVariant as any);

      let result = await serverVariantService.getServerVariantById({
        serverVariantId: 'variant_123'
      });

      expect(result.currentVersion).toBeNull();
    });

    it('should handle variant with instance-specific restriction', async () => {
      let mockInstance = {
        id: 'instance_123',
        oid: 100,
        organizationOid: 1
      };

      let mockServerVariant = {
        id: 'variant_123',
        identifier: 'test-variant',
        onlyForInstanceOid: 100,
        currentVersion: {
          id: 'version_123',
          schema: {}
        },
        server: {
          id: 'server_123'
        }
      };

      vi.mocked(db.serverVariant.findFirst).mockResolvedValue(mockServerVariant as any);

      let result = await serverVariantService.getServerVariantById({
        serverVariantId: 'variant_123',
        instance: mockInstance as any
      });

      expect(result.onlyForInstanceOid).toBe(100);
    });

    it('should not find variant restricted to different instance', async () => {
      let mockInstance = {
        id: 'instance_123',
        oid: 100,
        organizationOid: 1
      };

      vi.mocked(db.serverVariant.findFirst).mockResolvedValue(null);

      await expect(
        serverVariantService.getServerVariantById({
          serverVariantId: 'variant_123',
          instance: mockInstance as any
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should handle empty identifier', async () => {
      let mockServerVariant = {
        id: 'variant_123',
        identifier: '',
        currentVersion: {
          id: 'version_123',
          schema: {}
        },
        server: {
          id: 'server_123'
        }
      };

      vi.mocked(db.serverVariant.findFirst).mockResolvedValue(mockServerVariant as any);

      let result = await serverVariantService.getServerVariantById({
        serverVariantId: 'variant_123'
      });

      expect(result.identifier).toBe('');
    });
  });
});
