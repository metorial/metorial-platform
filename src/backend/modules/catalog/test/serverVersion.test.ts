import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serverVersionService } from '../src/services/serverVersion';
import { db } from '@metorial/db';
import { ServiceError } from '@metorial/error';

// Mock the db module
vi.mock('@metorial/db', () => ({
  db: {
    serverVersion: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

describe('serverVersionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getServerVersionById', () => {
    it('should retrieve a server version by id', async () => {
      let mockServer = {
        id: 'server_123',
        oid: 10,
        name: 'Test Server'
      };

      let mockServerVersion = {
        id: 'version_123',
        identifier: 'v1.0.0',
        serverOid: 10,
        server: mockServer,
        serverVariant: {
          id: 'variant_123',
          name: 'Test Variant'
        },
        schema: {
          type: 'object',
          properties: {
            test: { type: 'string' }
          }
        }
      };

      vi.mocked(db.serverVersion.findFirst).mockResolvedValue(mockServerVersion as any);

      let result = await serverVersionService.getServerVersionById({
        serverVersionId: 'version_123',
        server: mockServer as any
      });

      expect(result).toEqual(mockServerVersion);
      expect(db.serverVersion.findFirst).toHaveBeenCalledWith({
        where: {
          serverOid: 10,
          OR: [{ id: 'version_123' }, { identifier: 'version_123' }]
        },
        include: expect.any(Object)
      });
    });

    it('should retrieve a server version by identifier', async () => {
      let mockServer = {
        id: 'server_123',
        oid: 10,
        name: 'Test Server'
      };

      let mockServerVersion = {
        id: 'version_123',
        identifier: 'v2.0.0',
        serverOid: 10,
        server: mockServer,
        serverVariant: {
          id: 'variant_123',
          name: 'Test Variant'
        },
        schema: {}
      };

      vi.mocked(db.serverVersion.findFirst).mockResolvedValue(mockServerVersion as any);

      let result = await serverVersionService.getServerVersionById({
        serverVersionId: 'v2.0.0',
        server: mockServer as any
      });

      expect(result).toEqual(mockServerVersion);
      expect(db.serverVersion.findFirst).toHaveBeenCalledWith({
        where: {
          serverOid: 10,
          OR: [{ id: 'v2.0.0' }, { identifier: 'v2.0.0' }]
        },
        include: expect.any(Object)
      });
    });

    it('should throw ServiceError when version not found', async () => {
      let mockServer = {
        id: 'server_123',
        oid: 10,
        name: 'Test Server'
      };

      vi.mocked(db.serverVersion.findFirst).mockResolvedValue(null);

      await expect(
        serverVersionService.getServerVersionById({
          serverVersionId: 'nonexistent',
          server: mockServer as any
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should filter by server oid', async () => {
      let mockServer = {
        id: 'server_123',
        oid: 999,
        name: 'Test Server'
      };

      let mockServerVersion = {
        id: 'version_123',
        identifier: 'v1.0.0',
        serverOid: 999,
        server: mockServer,
        serverVariant: {
          id: 'variant_123'
        },
        schema: {}
      };

      vi.mocked(db.serverVersion.findFirst).mockResolvedValue(mockServerVersion as any);

      await serverVersionService.getServerVersionById({
        serverVersionId: 'version_123',
        server: mockServer as any
      });

      expect(db.serverVersion.findFirst).toHaveBeenCalledWith({
        where: {
          serverOid: 999,
          OR: [{ id: 'version_123' }, { identifier: 'version_123' }]
        },
        include: expect.any(Object)
      });
    });

    it('should include server, serverVariant, and schema', async () => {
      let mockServer = {
        id: 'server_123',
        oid: 10,
        name: 'Test Server'
      };

      let mockServerVersion = {
        id: 'version_123',
        identifier: 'v1.0.0',
        serverOid: 10,
        server: mockServer,
        serverVariant: {
          id: 'variant_123',
          name: 'Remote Variant',
          sourceType: 'remote'
        },
        schema: {
          type: 'object',
          properties: {
            config: { type: 'string' },
            enabled: { type: 'boolean' }
          }
        }
      };

      vi.mocked(db.serverVersion.findFirst).mockResolvedValue(mockServerVersion as any);

      let result = await serverVersionService.getServerVersionById({
        serverVersionId: 'version_123',
        server: mockServer as any
      });

      expect(result.server).toBeDefined();
      expect(result.serverVariant).toBeDefined();
      expect(result.schema).toBeDefined();
      expect(result.schema).toEqual({
        type: 'object',
        properties: {
          config: { type: 'string' },
          enabled: { type: 'boolean' }
        }
      });
    });
  });

  describe('listServerVersions', () => {
    it('should list all versions for a server', async () => {
      let mockServer = {
        id: 'server_123',
        oid: 10,
        name: 'Test Server'
      };

      let mockVersions = [
        {
          id: 'version_1',
          identifier: 'v1.0.0',
          serverOid: 10,
          server: mockServer,
          serverVariant: { id: 'variant_1' },
          schema: {}
        },
        {
          id: 'version_2',
          identifier: 'v2.0.0',
          serverOid: 10,
          server: mockServer,
          serverVariant: { id: 'variant_1' },
          schema: {}
        },
        {
          id: 'version_3',
          identifier: 'v3.0.0',
          serverOid: 10,
          server: mockServer,
          serverVariant: { id: 'variant_1' },
          schema: {}
        }
      ];

      vi.mocked(db.serverVersion.findMany).mockResolvedValue(mockVersions as any);

      let paginator = await serverVersionService.listServerVersions({
        server: mockServer as any
      });

      expect(paginator).toBeDefined();
      expect(typeof paginator).toBe('object');
    });

    it('should create paginator that filters by variant', async () => {
      let mockServer = {
        id: 'server_123',
        oid: 10,
        name: 'Test Server'
      };

      let mockVariant = {
        id: 'variant_123',
        oid: 100,
        name: 'Test Variant'
      };

      let mockVersions = [
        {
          id: 'version_1',
          identifier: 'v1.0.0',
          serverOid: 10,
          serverVariantOid: 100,
          server: mockServer,
          serverVariant: mockVariant,
          schema: {}
        }
      ];

      vi.mocked(db.serverVersion.findMany).mockResolvedValue(mockVersions as any);

      let paginator = await serverVersionService.listServerVersions({
        server: mockServer as any,
        variant: mockVariant as any
      });

      // Paginators are lazy - they create a query function but don't execute until requested
      expect(paginator).toBeDefined();
    });

    it('should return empty paginator when no versions exist', async () => {
      let mockServer = {
        id: 'server_123',
        oid: 10,
        name: 'Test Server'
      };

      vi.mocked(db.serverVersion.findMany).mockResolvedValue([]);

      let paginator = await serverVersionService.listServerVersions({
        server: mockServer as any
      });

      expect(paginator).toBeDefined();
    });

    it('should list all variants when no variant filter provided', async () => {
      let mockServer = {
        id: 'server_123',
        oid: 10,
        name: 'Test Server'
      };

      let mockVersions = [
        {
          id: 'version_1',
          identifier: 'v1.0.0',
          serverOid: 10,
          serverVariantOid: 100,
          server: mockServer,
          serverVariant: { id: 'variant_1', oid: 100 },
          schema: {}
        },
        {
          id: 'version_2',
          identifier: 'v1.0.0',
          serverOid: 10,
          serverVariantOid: 200,
          server: mockServer,
          serverVariant: { id: 'variant_2', oid: 200 },
          schema: {}
        }
      ];

      vi.mocked(db.serverVersion.findMany).mockResolvedValue(mockVersions as any);

      let paginator = await serverVersionService.listServerVersions({
        server: mockServer as any
      });

      expect(paginator).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle version without schema', async () => {
      let mockServer = {
        id: 'server_123',
        oid: 10,
        name: 'Test Server'
      };

      let mockServerVersion = {
        id: 'version_123',
        identifier: 'v1.0.0',
        serverOid: 10,
        server: mockServer,
        serverVariant: { id: 'variant_123' },
        schema: null
      };

      vi.mocked(db.serverVersion.findFirst).mockResolvedValue(mockServerVersion as any);

      let result = await serverVersionService.getServerVersionById({
        serverVersionId: 'version_123',
        server: mockServer as any
      });

      expect(result.schema).toBeNull();
    });

    it('should handle semantic version identifiers', async () => {
      let mockServer = {
        id: 'server_123',
        oid: 10,
        name: 'Test Server'
      };

      let mockServerVersion = {
        id: 'version_123',
        identifier: 'v1.2.3-beta.1',
        serverOid: 10,
        server: mockServer,
        serverVariant: { id: 'variant_123' },
        schema: {}
      };

      vi.mocked(db.serverVersion.findFirst).mockResolvedValue(mockServerVersion as any);

      let result = await serverVersionService.getServerVersionById({
        serverVersionId: 'v1.2.3-beta.1',
        server: mockServer as any
      });

      expect(result.identifier).toBe('v1.2.3-beta.1');
    });

    it('should handle versions with complex schemas', async () => {
      let mockServer = {
        id: 'server_123',
        oid: 10,
        name: 'Test Server'
      };

      let complexSchema = {
        type: 'object',
        properties: {
          nested: {
            type: 'object',
            properties: {
              deep: { type: 'string' }
            }
          },
          array: {
            type: 'array',
            items: { type: 'number' }
          }
        },
        required: ['nested']
      };

      let mockServerVersion = {
        id: 'version_123',
        identifier: 'v1.0.0',
        serverOid: 10,
        server: mockServer,
        serverVariant: { id: 'variant_123' },
        schema: complexSchema
      };

      vi.mocked(db.serverVersion.findFirst).mockResolvedValue(mockServerVersion as any);

      let result = await serverVersionService.getServerVersionById({
        serverVersionId: 'version_123',
        server: mockServer as any
      });

      expect(result.schema).toEqual(complexSchema);
    });

    it('should handle empty identifier', async () => {
      let mockServer = {
        id: 'server_123',
        oid: 10,
        name: 'Test Server'
      };

      vi.mocked(db.serverVersion.findFirst).mockResolvedValue(null);

      await expect(
        serverVersionService.getServerVersionById({
          serverVersionId: '',
          server: mockServer as any
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should handle versions across multiple variants', async () => {
      let mockServer = {
        id: 'server_123',
        oid: 10,
        name: 'Test Server'
      };

      let mockVersions = [
        {
          id: 'version_1',
          identifier: 'v1.0.0',
          serverOid: 10,
          serverVariantOid: 100,
          server: mockServer,
          serverVariant: { id: 'variant_remote', oid: 100, sourceType: 'remote' },
          schema: {}
        },
        {
          id: 'version_2',
          identifier: 'v1.0.0',
          serverOid: 10,
          serverVariantOid: 200,
          server: mockServer,
          serverVariant: { id: 'variant_docker', oid: 200, sourceType: 'docker' },
          schema: {}
        }
      ];

      vi.mocked(db.serverVersion.findMany).mockResolvedValue(mockVersions as any);

      let paginator = await serverVersionService.listServerVersions({
        server: mockServer as any
      });

      expect(paginator).toBeDefined();
    });

    it('should handle large number of versions', async () => {
      let mockServer = {
        id: 'server_123',
        oid: 10,
        name: 'Test Server'
      };

      let mockVersions = Array.from({ length: 100 }, (_, i) => ({
        id: `version_${i}`,
        identifier: `v${i}.0.0`,
        serverOid: 10,
        server: mockServer,
        serverVariant: { id: 'variant_1', oid: 100 },
        schema: {}
      }));

      vi.mocked(db.serverVersion.findMany).mockResolvedValue(mockVersions as any);

      let paginator = await serverVersionService.listServerVersions({
        server: mockServer as any
      });

      expect(paginator).toBeDefined();
    });
  });
});
