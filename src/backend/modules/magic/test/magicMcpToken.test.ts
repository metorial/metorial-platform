import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceError, notFoundError, preconditionFailedError, unauthorizedError } from '@metorial/error';
import { magicMcpTokenService } from '../src/services/magicMcpToken';

// Mock external dependencies
vi.mock('@metorial/db', () => ({
  db: {
    magicMcpToken: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn()
    },
    organization: {
      findFirstOrThrow: vi.fn()
    }
  },
  ID: {
    generateId: vi.fn().mockResolvedValue('mcp_tkn_123')
  }
}));

vi.mock('@metorial/api-keys', () => ({
  UnifiedApiKey: {
    create: vi.fn().mockReturnValue({
      toString: vi.fn().mockReturnValue('met_mcp_test_secret_token_abc123xyz')
    })
  }
}));

vi.mock('@metorial/config', () => ({
  getConfig: vi.fn().mockReturnValue({
    urls: {
      mcpUrl: 'https://mcp.example.com'
    }
  })
}));

vi.mock('@metorial/lock', () => ({
  createLock: vi.fn().mockReturnValue({
    usingLock: vi.fn().mockImplementation(async (id, fn) => fn())
  })
}));

vi.mock('@metorial/module-organization', () => ({
  organizationActorService: {
    getSystemActor: vi.fn().mockResolvedValue({ id: 'system_actor_1' })
  }
}));

vi.mock('@metorial/pagination', () => ({
  Paginator: {
    create: vi.fn(fn => fn({ prisma: (cb: any) => cb({}) }))
  }
}));

import { db } from '@metorial/db';
import { UnifiedApiKey } from '@metorial/api-keys';
import { organizationActorService } from '@metorial/module-organization';

const mockInstance = { oid: 'inst_oid_1', id: 'inst_1', organizationOid: 'org_oid_1' } as any;
const mockOrganization = { oid: 'org_oid_1', id: 'org_1' } as any;
const mockPerformedBy = { id: 'actor_1' } as any;
const mockContext = {} as any;

describe('magicMcpTokenService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMagicMcpTokenById', () => {
    it('should return token by ID', async () => {
      const mockToken = {
        id: 'mcp_tkn_1',
        name: 'Test Token',
        status: 'active',
        secret: 'met_mcp_secret_123'
      };
      vi.mocked(db.magicMcpToken.findFirst).mockResolvedValue(mockToken as any);

      const result = await magicMcpTokenService.getMagicMcpTokenById({
        instance: mockInstance,
        magicMcpTokenId: 'mcp_tkn_1'
      });

      expect(result).toEqual(mockToken);
      expect(db.magicMcpToken.findFirst).toHaveBeenCalledWith({
        where: {
          instanceOid: 'inst_oid_1',
          id: 'mcp_tkn_1'
        },
        include: {}
      });
    });

    it('should throw not found error when token does not exist', async () => {
      vi.mocked(db.magicMcpToken.findFirst).mockResolvedValue(null);

      await expect(
        magicMcpTokenService.getMagicMcpTokenById({
          instance: mockInstance,
          magicMcpTokenId: 'nonexistent'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should filter by instance OID', async () => {
      vi.mocked(db.magicMcpToken.findFirst).mockResolvedValue(null);

      await expect(
        magicMcpTokenService.getMagicMcpTokenById({
          instance: mockInstance,
          magicMcpTokenId: 'mcp_tkn_1'
        })
      ).rejects.toThrow();

      expect(db.magicMcpToken.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            instanceOid: 'inst_oid_1'
          })
        })
      );
    });
  });

  describe('getMagicMcpTokenBySecret', () => {
    it('should return token by secret', async () => {
      const mockToken = {
        id: 'mcp_tkn_1',
        secret: 'met_mcp_secret_123',
        status: 'active',
        instance: {
          id: 'inst_1',
          organization: { id: 'org_1' }
        }
      };
      vi.mocked(db.magicMcpToken.findFirst).mockResolvedValue(mockToken as any);

      const result = await magicMcpTokenService.getMagicMcpTokenBySecret({
        secret: 'met_mcp_secret_123'
      });

      expect(result).toEqual(mockToken);
      expect(db.magicMcpToken.findFirst).toHaveBeenCalledWith({
        where: {
          secret: 'met_mcp_secret_123',
          status: 'active'
        },
        include: {
          instance: {
            include: { organization: true }
          }
        }
      });
    });

    it('should only return active tokens', async () => {
      vi.mocked(db.magicMcpToken.findFirst).mockResolvedValue(null);

      await expect(
        magicMcpTokenService.getMagicMcpTokenBySecret({
          secret: 'met_mcp_deleted_secret'
        })
      ).rejects.toThrow(ServiceError);

      expect(db.magicMcpToken.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'active'
          })
        })
      );
    });

    it('should throw unauthorized error with invalid secret', async () => {
      vi.mocked(db.magicMcpToken.findFirst).mockResolvedValue(null);

      await expect(
        magicMcpTokenService.getMagicMcpTokenBySecret({
          secret: 'invalid_secret'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should include instance and organization in response', async () => {
      const mockToken = {
        id: 'mcp_tkn_1',
        secret: 'met_mcp_secret_123',
        status: 'active',
        instance: {
          id: 'inst_1',
          oid: 'inst_oid_1',
          organization: {
            id: 'org_1',
            oid: 'org_oid_1',
            name: 'Test Org'
          }
        }
      };
      vi.mocked(db.magicMcpToken.findFirst).mockResolvedValue(mockToken as any);

      const result = await magicMcpTokenService.getMagicMcpTokenBySecret({
        secret: 'met_mcp_secret_123'
      });

      expect(result.instance).toBeDefined();
      expect(result.instance.organization).toBeDefined();
    });
  });

  describe('getManyMagicMcpTokens', () => {
    it('should return multiple tokens by IDs', async () => {
      const mockTokens = [
        { id: 'mcp_tkn_1', name: 'Token 1', status: 'active' },
        { id: 'mcp_tkn_2', name: 'Token 2', status: 'active' }
      ];
      vi.mocked(db.magicMcpToken.findMany).mockResolvedValue(mockTokens as any);

      const result = await magicMcpTokenService.getManyMagicMcpTokens({
        magicMcpTokenId: ['mcp_tkn_1', 'mcp_tkn_2'],
        instance: mockInstance
      });

      expect(result).toEqual(mockTokens);
      expect(db.magicMcpToken.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['mcp_tkn_1', 'mcp_tkn_2'] },
          instanceOid: 'inst_oid_1'
        },
        include: {}
      });
    });

    it('should return empty array when no IDs provided', async () => {
      const result = await magicMcpTokenService.getManyMagicMcpTokens({
        magicMcpTokenId: [],
        instance: mockInstance
      });

      expect(result).toEqual([]);
      expect(db.magicMcpToken.findMany).not.toHaveBeenCalled();
    });

    it('should filter by instance', async () => {
      vi.mocked(db.magicMcpToken.findMany).mockResolvedValue([]);

      await magicMcpTokenService.getManyMagicMcpTokens({
        magicMcpTokenId: ['mcp_tkn_1'],
        instance: mockInstance
      });

      expect(db.magicMcpToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            instanceOid: 'inst_oid_1'
          })
        })
      );
    });
  });

  describe('createMagicMcpToken', () => {
    it('should create a new token with generated secret', async () => {
      const mockCreatedToken = {
        id: 'mcp_tkn_123',
        name: 'Test Token',
        secret: 'met_mcp_test_secret_token_abc123xyz',
        status: 'active',
        metadata: { key: 'value' }
      };

      vi.mocked(db.magicMcpToken.create).mockResolvedValue(mockCreatedToken as any);

      const result = await magicMcpTokenService.createMagicMcpToken({
        organization: mockOrganization,
        performedBy: mockPerformedBy,
        instance: mockInstance,
        context: mockContext,
        input: {
          name: 'Test Token',
          description: 'A test token',
          metadata: { key: 'value' }
        }
      });

      expect(result).toEqual(mockCreatedToken);
      expect(UnifiedApiKey.create).toHaveBeenCalledWith({
        type: 'magic_mcp_token_secret',
        config: { url: 'https://mcp.example.com' }
      });
    });

    it('should create token with empty metadata when not provided', async () => {
      const mockCreatedToken = {
        id: 'mcp_tkn_123',
        metadata: {}
      };

      vi.mocked(db.magicMcpToken.create).mockResolvedValue(mockCreatedToken as any);

      await magicMcpTokenService.createMagicMcpToken({
        organization: mockOrganization,
        performedBy: mockPerformedBy,
        instance: mockInstance,
        input: { name: 'Test' }
      });

      expect(db.magicMcpToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: {}
          })
        })
      );
    });

    it('should set status to active by default', async () => {
      vi.mocked(db.magicMcpToken.create).mockResolvedValue({ id: 'mcp_tkn_123' } as any);

      await magicMcpTokenService.createMagicMcpToken({
        organization: mockOrganization,
        performedBy: mockPerformedBy,
        instance: mockInstance,
        input: { name: 'Test' }
      });

      expect(db.magicMcpToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'active'
          })
        })
      );
    });

    it('should associate token with instance', async () => {
      vi.mocked(db.magicMcpToken.create).mockResolvedValue({ id: 'mcp_tkn_123' } as any);

      await magicMcpTokenService.createMagicMcpToken({
        organization: mockOrganization,
        performedBy: mockPerformedBy,
        instance: mockInstance,
        input: { name: 'Test' }
      });

      expect(db.magicMcpToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            instanceOid: 'inst_oid_1'
          })
        })
      );
    });
  });

  describe('deletedMagicMcpToken', () => {
    it('should delete an active token', async () => {
      const mockToken = { id: 'mcp_tkn_1', status: 'active' } as any;
      const mockDeletedToken = {
        id: 'mcp_tkn_1',
        status: 'deleted',
        deletedAt: expect.any(Date)
      };

      vi.mocked(db.magicMcpToken.update).mockResolvedValue(mockDeletedToken as any);

      const result = await magicMcpTokenService.deletedMagicMcpToken({
        token: mockToken
      });

      expect(result.status).toBe('deleted');
      expect(db.magicMcpToken.update).toHaveBeenCalledWith({
        where: { id: 'mcp_tkn_1' },
        data: { status: 'deleted', deletedAt: expect.any(Date) },
        include: {}
      });
    });

    it('should throw precondition failed error when token is already deleted', async () => {
      const mockToken = { id: 'mcp_tkn_1', status: 'deleted' } as any;

      await expect(
        magicMcpTokenService.deletedMagicMcpToken({
          token: mockToken
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should set deletedAt timestamp', async () => {
      const mockToken = { id: 'mcp_tkn_1', status: 'active' } as any;
      const now = new Date();

      vi.mocked(db.magicMcpToken.update).mockImplementation(async (args: any) => {
        expect(args.data.deletedAt).toBeInstanceOf(Date);
        expect(args.data.deletedAt.getTime()).toBeGreaterThanOrEqual(now.getTime());
        return { id: 'mcp_tkn_1', status: 'deleted', deletedAt: args.data.deletedAt } as any;
      });

      await magicMcpTokenService.deletedMagicMcpToken({
        token: mockToken
      });
    });
  });

  describe('updateMagicMcpToken', () => {
    it('should update token name and description', async () => {
      const mockToken = {
        id: 'mcp_tkn_1',
        status: 'active',
        name: 'Old Name',
        description: 'Old Description',
        metadata: {}
      } as any;

      const mockUpdatedToken = {
        id: 'mcp_tkn_1',
        name: 'New Name',
        description: 'New Description'
      };

      vi.mocked(db.magicMcpToken.update).mockResolvedValue(mockUpdatedToken as any);

      const result = await magicMcpTokenService.updateMagicMcpToken({
        token: mockToken,
        input: {
          name: 'New Name',
          description: 'New Description'
        }
      });

      expect(result.name).toBe('New Name');
      expect(result.description).toBe('New Description');
    });

    it('should throw error when updating deleted token', async () => {
      const mockToken = {
        id: 'mcp_tkn_1',
        status: 'deleted'
      } as any;

      await expect(
        magicMcpTokenService.updateMagicMcpToken({
          token: mockToken,
          input: { name: 'New Name' }
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should preserve existing values when input is undefined', async () => {
      const mockToken = {
        id: 'mcp_tkn_1',
        status: 'active',
        name: 'Original Name',
        description: 'Original Description',
        metadata: { key: 'value' }
      } as any;

      vi.mocked(db.magicMcpToken.update).mockImplementation(async (args: any) => {
        expect(args.data.name).toBe('Original Name');
        expect(args.data.description).toBe('Original Description');
        expect(args.data.metadata).toEqual({ key: 'value' });
        return mockToken;
      });

      await magicMcpTokenService.updateMagicMcpToken({
        token: mockToken,
        input: {}
      });
    });

    it('should allow setting fields to null explicitly', async () => {
      const mockToken = {
        id: 'mcp_tkn_1',
        status: 'active',
        name: 'Original Name',
        description: 'Original Description',
        metadata: { key: 'value' }
      } as any;

      vi.mocked(db.magicMcpToken.update).mockImplementation(async (args: any) => {
        expect(args.data.name).toBeNull();
        expect(args.data.description).toBeNull();
        expect(args.data.metadata).toBeNull();
        return mockToken;
      });

      await magicMcpTokenService.updateMagicMcpToken({
        token: mockToken,
        input: {
          name: null,
          description: null,
          metadata: null
        }
      });
    });

    it('should update metadata independently', async () => {
      const mockToken = {
        id: 'mcp_tkn_1',
        status: 'active',
        name: 'Token',
        metadata: { old: 'data' }
      } as any;

      vi.mocked(db.magicMcpToken.update).mockImplementation(async (args: any) => {
        expect(args.data.metadata).toEqual({ new: 'data' });
        return { ...mockToken, metadata: { new: 'data' } };
      });

      await magicMcpTokenService.updateMagicMcpToken({
        token: mockToken,
        input: {
          metadata: { new: 'data' }
        }
      });
    });
  });

  describe('listMagicMcpTokens', () => {
    it('should list active tokens', async () => {
      const mockTokens = [
        { id: 'mcp_tkn_1', name: 'Token 1', status: 'active' },
        { id: 'mcp_tkn_2', name: 'Token 2', status: 'active' }
      ];

      vi.mocked(db.magicMcpToken.findMany).mockResolvedValue(mockTokens as any);

      const result = await magicMcpTokenService.listMagicMcpTokens({
        instance: mockInstance
      });

      expect(result).toBeDefined();
    });

    it('should filter by status', async () => {
      vi.mocked(db.magicMcpToken.findMany).mockResolvedValue([]);

      await magicMcpTokenService.listMagicMcpTokens({
        instance: mockInstance,
        status: ['active']
      });

      expect(db.magicMcpToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['active'] }
          })
        })
      );
    });

    it('should filter out deleted tokens older than 3 days', async () => {
      vi.mocked(db.magicMcpToken.findMany).mockResolvedValue([]);

      await magicMcpTokenService.listMagicMcpTokens({
        instance: mockInstance
      });

      expect(db.magicMcpToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { deletedAt: null },
              { deletedAt: { gt: expect.any(Date) } }
            ]
          })
        })
      );
    });

    it('should auto-create default token when no active tokens exist', async () => {
      // First call returns empty, triggering auto-creation
      vi.mocked(db.magicMcpToken.findMany).mockResolvedValueOnce([]);

      // Count returns 0, confirming no active tokens
      vi.mocked(db.magicMcpToken.count).mockResolvedValue(0);

      // Organization lookup
      vi.mocked(db.organization.findFirstOrThrow).mockResolvedValue(mockOrganization as any);

      // System actor
      vi.mocked(organizationActorService.getSystemActor).mockResolvedValue({ id: 'system_actor' } as any);

      // Create token
      vi.mocked(db.magicMcpToken.create).mockResolvedValue({
        id: 'mcp_tkn_auto',
        name: 'Default Token',
        status: 'active'
      } as any);

      // Second call returns the auto-created token
      vi.mocked(db.magicMcpToken.findMany).mockResolvedValueOnce([
        { id: 'mcp_tkn_auto', name: 'Default Token', status: 'active' }
      ] as any);

      await magicMcpTokenService.listMagicMcpTokens({
        instance: mockInstance
      });

      expect(db.magicMcpToken.count).toHaveBeenCalledWith({
        where: { instanceOid: 'inst_oid_1', status: 'active' }
      });

      expect(organizationActorService.getSystemActor).toHaveBeenCalled();
    });

    it('should not auto-create token when active tokens exist', async () => {
      const mockTokens = [
        { id: 'mcp_tkn_1', name: 'Existing Token', status: 'active' }
      ];

      vi.mocked(db.magicMcpToken.findMany).mockResolvedValue(mockTokens as any);

      await magicMcpTokenService.listMagicMcpTokens({
        instance: mockInstance
      });

      expect(db.magicMcpToken.count).not.toHaveBeenCalled();
      expect(db.magicMcpToken.create).not.toHaveBeenCalled();
    });

    it('should filter by instance', async () => {
      vi.mocked(db.magicMcpToken.findMany).mockResolvedValue([]);

      await magicMcpTokenService.listMagicMcpTokens({
        instance: mockInstance
      });

      expect(db.magicMcpToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            instanceOid: 'inst_oid_1'
          })
        })
      );
    });

    it('should handle multiple status filters', async () => {
      vi.mocked(db.magicMcpToken.findMany).mockResolvedValue([]);

      await magicMcpTokenService.listMagicMcpTokens({
        instance: mockInstance,
        status: ['active', 'deleted']
      });

      expect(db.magicMcpToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['active', 'deleted'] }
          })
        })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle token with special characters in name', async () => {
      vi.mocked(db.magicMcpToken.create).mockResolvedValue({
        id: 'mcp_tkn_123',
        name: 'Special @#$ Token!'
      } as any);

      const result = await magicMcpTokenService.createMagicMcpToken({
        organization: mockOrganization,
        performedBy: mockPerformedBy,
        instance: mockInstance,
        input: { name: 'Special @#$ Token!' }
      });

      expect(result.name).toBe('Special @#$ Token!');
    });

    it('should handle very long token names', async () => {
      const longName = 'A'.repeat(1000);
      vi.mocked(db.magicMcpToken.create).mockResolvedValue({
        id: 'mcp_tkn_123',
        name: longName
      } as any);

      const result = await magicMcpTokenService.createMagicMcpToken({
        organization: mockOrganization,
        performedBy: mockPerformedBy,
        instance: mockInstance,
        input: { name: longName }
      });

      expect(result.name).toBe(longName);
    });

    it('should handle token with complex metadata', async () => {
      const complexMetadata = {
        nested: {
          deeply: {
            nested: {
              value: 'test'
            }
          }
        },
        array: [1, 2, 3],
        boolean: true,
        null: null
      };

      vi.mocked(db.magicMcpToken.create).mockResolvedValue({
        id: 'mcp_tkn_123',
        metadata: complexMetadata
      } as any);

      const result = await magicMcpTokenService.createMagicMcpToken({
        organization: mockOrganization,
        performedBy: mockPerformedBy,
        instance: mockInstance,
        input: { name: 'Test', metadata: complexMetadata }
      });

      expect(result.metadata).toEqual(complexMetadata);
    });

    it('should handle concurrent list calls with auto-creation', async () => {
      // Simulate lock preventing double creation
      vi.mocked(db.magicMcpToken.findMany).mockResolvedValue([]);
      vi.mocked(db.magicMcpToken.count).mockResolvedValue(0);
      vi.mocked(db.organization.findFirstOrThrow).mockResolvedValue(mockOrganization as any);

      await magicMcpTokenService.listMagicMcpTokens({
        instance: mockInstance
      });

      // Lock should prevent multiple creations
      expect(db.magicMcpToken.create).toHaveBeenCalledTimes(1);
    });

    it('should preserve token secret when updating', async () => {
      const mockToken = {
        id: 'mcp_tkn_1',
        status: 'active',
        name: 'Token',
        secret: 'met_mcp_original_secret'
      } as any;

      vi.mocked(db.magicMcpToken.update).mockImplementation(async (args: any) => {
        // Secret should not be in update data
        expect(args.data).not.toHaveProperty('secret');
        return { ...mockToken, name: 'Updated Token' };
      });

      await magicMcpTokenService.updateMagicMcpToken({
        token: mockToken,
        input: { name: 'Updated Token' }
      });
    });
  });
});
