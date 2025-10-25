import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serverService } from '../src/services/server';
import { db } from '@metorial/db';
import { ServiceError } from '@metorial/error';

// Mock the db module
vi.mock('@metorial/db', () => ({
  db: {
    server: {
      findFirst: vi.fn()
    }
  }
}));

describe('serverService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getServerById', () => {
    it('should retrieve a server by id', async () => {
      let mockServer = {
        id: 'server_123',
        type: 'imported',
        isPublic: true,
        customServer: null,
        importedServer: {
          name: 'Test Server',
          description: 'Test Description'
        },
        variants: [
          {
            id: 'variant_1',
            currentVersion: {
              id: 'version_1',
              schema: {}
            }
          }
        ]
      };

      vi.mocked(db.server.findFirst).mockResolvedValue(mockServer as any);

      let result = await serverService.getServerById({ serverId: 'server_123' });

      expect(result).toEqual(mockServer);
      expect(db.server.findFirst).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              OR: [{ id: 'server_123' }, { listing: { id: 'server_123' } }, { listing: { slug: 'server_123' } }]
            },
            {
              OR: [{ type: 'imported' }, { isPublic: true }, { ownerOrganizationOid: undefined }]
            }
          ]
        },
        include: expect.any(Object)
      });
    });

    it('should retrieve a server by listing id', async () => {
      let mockServer = {
        id: 'server_123',
        type: 'imported',
        isPublic: true,
        customServer: null,
        importedServer: {
          name: 'Test Server',
          description: 'Test Description'
        },
        variants: []
      };

      vi.mocked(db.server.findFirst).mockResolvedValue(mockServer as any);

      let result = await serverService.getServerById({ serverId: 'listing_123' });

      expect(result).toEqual(mockServer);
      expect(db.server.findFirst).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              OR: [{ id: 'listing_123' }, { listing: { id: 'listing_123' } }, { listing: { slug: 'listing_123' } }]
            },
            {
              OR: [{ type: 'imported' }, { isPublic: true }, { ownerOrganizationOid: undefined }]
            }
          ]
        },
        include: expect.any(Object)
      });
    });

    it('should retrieve a server by slug', async () => {
      let mockServer = {
        id: 'server_123',
        type: 'imported',
        isPublic: true,
        customServer: null,
        importedServer: {
          name: 'Test Server',
          description: 'Test Description'
        },
        variants: []
      };

      vi.mocked(db.server.findFirst).mockResolvedValue(mockServer as any);

      await serverService.getServerById({ serverId: 'test-server-slug' });

      expect(db.server.findFirst).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              OR: [
                { id: 'test-server-slug' },
                { listing: { id: 'test-server-slug' } },
                { listing: { slug: 'test-server-slug' } }
              ]
            },
            {
              OR: [{ type: 'imported' }, { isPublic: true }, { ownerOrganizationOid: undefined }]
            }
          ]
        },
        include: expect.any(Object)
      });
    });

    it('should retrieve a server with organization context', async () => {
      let mockOrganization = {
        id: 'org_123',
        oid: 1,
        name: 'Test Org'
      };

      let mockServer = {
        id: 'server_123',
        type: 'custom',
        isPublic: false,
        ownerOrganizationOid: 1,
        customServer: {
          organizationOid: 1,
          name: 'Custom Server'
        },
        importedServer: null,
        variants: []
      };

      vi.mocked(db.server.findFirst).mockResolvedValue(mockServer as any);

      let result = await serverService.getServerById({
        serverId: 'server_123',
        organization: mockOrganization as any
      });

      expect(result).toEqual(mockServer);
      expect(db.server.findFirst).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              OR: [{ id: 'server_123' }, { listing: { id: 'server_123' } }, { listing: { slug: 'server_123' } }]
            },
            {
              OR: [{ type: 'imported' }, { isPublic: true }, { ownerOrganizationOid: 1 }]
            }
          ]
        },
        include: expect.any(Object)
      });
    });

    it('should throw ServiceError when server not found', async () => {
      vi.mocked(db.server.findFirst).mockResolvedValue(null);

      await expect(serverService.getServerById({ serverId: 'nonexistent' })).rejects.toThrow(ServiceError);
    });

    it('should hide custom server data when organization does not match', async () => {
      let mockOrganization = {
        id: 'org_123',
        oid: 1,
        name: 'Test Org'
      };

      let mockServer = {
        id: 'server_123',
        type: 'custom',
        isPublic: true,
        ownerOrganizationOid: 2,
        customServer: {
          organizationOid: 2,
          name: 'Custom Server'
        },
        importedServer: null,
        variants: []
      };

      vi.mocked(db.server.findFirst).mockResolvedValue(mockServer as any);

      let result = await serverService.getServerById({
        serverId: 'server_123',
        organization: mockOrganization as any
      });

      expect(result.customServer).toBeNull();
    });

    it('should keep custom server data when organization matches', async () => {
      let mockOrganization = {
        id: 'org_123',
        oid: 1,
        name: 'Test Org'
      };

      let mockServer = {
        id: 'server_123',
        type: 'custom',
        isPublic: true,
        ownerOrganizationOid: 1,
        customServer: {
          organizationOid: 1,
          name: 'Custom Server'
        },
        importedServer: null,
        variants: []
      };

      vi.mocked(db.server.findFirst).mockResolvedValue(mockServer as any);

      let result = await serverService.getServerById({
        serverId: 'server_123',
        organization: mockOrganization as any
      });

      expect(result.customServer).toEqual({
        organizationOid: 1,
        name: 'Custom Server'
      });
    });

    it('should include variants with their current versions', async () => {
      let mockServer = {
        id: 'server_123',
        type: 'imported',
        isPublic: true,
        customServer: null,
        importedServer: {
          name: 'Test Server'
        },
        variants: [
          {
            id: 'variant_1',
            currentVersion: {
              id: 'version_1',
              schema: { test: 'schema' }
            }
          },
          {
            id: 'variant_2',
            currentVersion: {
              id: 'version_2',
              schema: { test: 'schema2' }
            }
          }
        ]
      };

      vi.mocked(db.server.findFirst).mockResolvedValue(mockServer as any);

      let result = await serverService.getServerById({ serverId: 'server_123' });

      expect(result.variants).toHaveLength(2);
      expect(result.variants[0].currentVersion).toBeDefined();
      expect(result.variants[0].currentVersion?.schema).toEqual({ test: 'schema' });
    });
  });

  describe('edge cases', () => {
    it('should handle empty organization object', async () => {
      let mockServer = {
        id: 'server_123',
        type: 'imported',
        isPublic: true,
        customServer: null,
        importedServer: {},
        variants: []
      };

      vi.mocked(db.server.findFirst).mockResolvedValue(mockServer as any);

      await serverService.getServerById({ serverId: 'server_123', organization: undefined });

      expect(db.server.findFirst).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              OR: [{ id: 'server_123' }, { listing: { id: 'server_123' } }, { listing: { slug: 'server_123' } }]
            },
            {
              OR: [{ type: 'imported' }, { isPublic: true }, { ownerOrganizationOid: undefined }]
            }
          ]
        },
        include: expect.any(Object)
      });
    });

    it('should handle server without variants', async () => {
      let mockServer = {
        id: 'server_123',
        type: 'imported',
        isPublic: true,
        customServer: null,
        importedServer: {},
        variants: []
      };

      vi.mocked(db.server.findFirst).mockResolvedValue(mockServer as any);

      let result = await serverService.getServerById({ serverId: 'server_123' });

      expect(result.variants).toEqual([]);
    });

    it('should handle null customServer initially', async () => {
      let mockServer = {
        id: 'server_123',
        type: 'imported',
        isPublic: true,
        customServer: null,
        importedServer: {},
        variants: []
      };

      vi.mocked(db.server.findFirst).mockResolvedValue(mockServer as any);

      let result = await serverService.getServerById({
        serverId: 'server_123',
        organization: { id: 'org_123', oid: 1 } as any
      });

      expect(result.customServer).toBeNull();
    });
  });
});
