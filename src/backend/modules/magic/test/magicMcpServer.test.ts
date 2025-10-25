import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceError, notFoundError, preconditionFailedError } from '@metorial/error';
import { magicMcpServerService } from '../src/services/magicMcpServer';

// Mock external dependencies
vi.mock('@metorial/db', () => ({
  db: {
    magicMcpServer: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    server: {
      findMany: vi.fn()
    },
    serverVariant: {
      findMany: vi.fn()
    },
    serverImplementation: {
      findMany: vi.fn()
    },
    session: {
      findMany: vi.fn()
    }
  },
  ID: {
    generateId: vi.fn()
      .mockResolvedValueOnce('mcp_srv_123')
      .mockResolvedValueOnce('mcp_srv_dep_123')
  },
  withTransaction: vi.fn(async (fn) => fn({
    magicMcpServer: {
      create: vi.fn().mockResolvedValue({ id: 'mcp_srv_123', status: 'active' })
    }
  }))
}));

vi.mock('@metorial/id', () => ({
  generateCode: vi.fn().mockReturnValue('abc12')
}));

vi.mock('@metorial/slugify', () => ({
  slugify: vi.fn().mockImplementation((str) => str.toLowerCase().replace(/\s+/g, '-'))
}));

vi.mock('@metorial/module-search', () => ({
  searchService: {
    search: vi.fn()
  }
}));

vi.mock('@metorial/pagination', () => ({
  Paginator: {
    create: vi.fn(fn => fn({ prisma: (cb: any) => cb({}) }))
  }
}));

import { db, withTransaction } from '@metorial/db';
import { generateCode } from '@metorial/id';
import { slugify } from '@metorial/slugify';
import { searchService } from '@metorial/module-search';

const mockInstance = { oid: 'inst_oid_1', id: 'inst_1' } as any;
const mockOrganization = { oid: 'org_oid_1', id: 'org_1' } as any;
const mockPerformedBy = { id: 'actor_1' } as any;
const mockServerDeployment = { oid: 'srv_dep_oid_1', id: 'srv_dep_1' } as any;
const mockContext = {} as any;

describe('magicMcpServerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMagicMcpServerById', () => {
    it('should return server by ID', async () => {
      const mockServer = { id: 'mcp_srv_1', name: 'Test Server', status: 'active' };
      vi.mocked(db.magicMcpServer.findFirst).mockResolvedValue(mockServer as any);

      const result = await magicMcpServerService.getMagicMcpServerById({
        instance: mockInstance,
        magicMcpServerId: 'mcp_srv_1'
      });

      expect(result).toEqual(mockServer);
      expect(db.magicMcpServer.findFirst).toHaveBeenCalledWith({
        where: {
          instanceOid: 'inst_oid_1',
          OR: [
            { id: 'mcp_srv_1' },
            {
              aliases: {
                some: { slug: 'mcp_srv_1' }
              }
            }
          ]
        },
        include: expect.any(Object)
      });
    });

    it('should return server by alias slug', async () => {
      const mockServer = { id: 'mcp_srv_1', name: 'Test Server', status: 'active' };
      vi.mocked(db.magicMcpServer.findFirst).mockResolvedValue(mockServer as any);

      const result = await magicMcpServerService.getMagicMcpServerById({
        instance: mockInstance,
        magicMcpServerId: 'test-server-alias'
      });

      expect(result).toEqual(mockServer);
      expect(db.magicMcpServer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                aliases: expect.objectContaining({
                  some: { slug: 'test-server-alias' }
                })
              })
            ])
          })
        })
      );
    });

    it('should throw not found error when server does not exist', async () => {
      vi.mocked(db.magicMcpServer.findFirst).mockResolvedValue(null);

      await expect(
        magicMcpServerService.getMagicMcpServerById({
          instance: mockInstance,
          magicMcpServerId: 'nonexistent'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should filter by instance OID', async () => {
      vi.mocked(db.magicMcpServer.findFirst).mockResolvedValue(null);

      await expect(
        magicMcpServerService.getMagicMcpServerById({
          instance: mockInstance,
          magicMcpServerId: 'mcp_srv_1'
        })
      ).rejects.toThrow();

      expect(db.magicMcpServer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            instanceOid: 'inst_oid_1'
          })
        })
      );
    });
  });

  describe('DANGEROUSLY_getMagicMcpServerOnlyById', () => {
    it('should return server without instance filter', async () => {
      const mockServer = {
        id: 'mcp_srv_1',
        name: 'Test Server',
        instance: mockInstance
      };
      vi.mocked(db.magicMcpServer.findFirst).mockResolvedValue(mockServer as any);

      const result = await magicMcpServerService.DANGEROUSLY_getMagicMcpServerOnlyById({
        magicMcpServerId: 'mcp_srv_1'
      });

      expect(result).toEqual(mockServer);
      expect(db.magicMcpServer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { id: 'mcp_srv_1' },
              {
                aliases: {
                  some: { slug: 'mcp_srv_1' }
                }
              }
            ]
          }),
          include: expect.objectContaining({
            instance: true
          })
        })
      );
    });

    it('should throw not found error when server does not exist', async () => {
      vi.mocked(db.magicMcpServer.findFirst).mockResolvedValue(null);

      await expect(
        magicMcpServerService.DANGEROUSLY_getMagicMcpServerOnlyById({
          magicMcpServerId: 'nonexistent'
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('getManyMagicMcpServers', () => {
    it('should return multiple servers by IDs', async () => {
      const mockServers = [
        { id: 'mcp_srv_1', name: 'Server 1' },
        { id: 'mcp_srv_2', name: 'Server 2' }
      ];
      vi.mocked(db.magicMcpServer.findMany).mockResolvedValue(mockServers as any);

      const result = await magicMcpServerService.getManyMagicMcpServers({
        magicMcpServerId: ['mcp_srv_1', 'mcp_srv_2'],
        instance: mockInstance
      });

      expect(result).toEqual(mockServers);
      expect(db.magicMcpServer.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['mcp_srv_1', 'mcp_srv_2'] },
          instanceOid: 'inst_oid_1'
        },
        include: expect.any(Object)
      });
    });

    it('should return empty array when no IDs provided', async () => {
      const result = await magicMcpServerService.getManyMagicMcpServers({
        magicMcpServerId: [],
        instance: mockInstance
      });

      expect(result).toEqual([]);
      expect(db.magicMcpServer.findMany).not.toHaveBeenCalled();
    });

    it('should filter by instance', async () => {
      vi.mocked(db.magicMcpServer.findMany).mockResolvedValue([]);

      await magicMcpServerService.getManyMagicMcpServers({
        magicMcpServerId: ['mcp_srv_1'],
        instance: mockInstance
      });

      expect(db.magicMcpServer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            instanceOid: 'inst_oid_1'
          })
        })
      );
    });
  });

  describe('createMagicMcpServer', () => {
    it('should create a new MCP server with generated slug', async () => {
      const mockCreatedServer = {
        id: 'mcp_srv_123',
        name: 'Test Server',
        status: 'active',
        aliases: [{ slug: 'test-server-abc12' }]
      };

      vi.mocked(generateCode).mockReturnValue('abc12');
      vi.mocked(slugify).mockReturnValue('test-server-abc12');
      vi.mocked(withTransaction).mockImplementation(async (fn) => {
        const mockDb = {
          magicMcpServer: {
            create: vi.fn().mockResolvedValue(mockCreatedServer)
          }
        };
        return fn(mockDb as any);
      });

      const result = await magicMcpServerService.createMagicMcpServer({
        organization: mockOrganization,
        performedBy: mockPerformedBy,
        instance: mockInstance,
        context: mockContext,
        serverDeployment: mockServerDeployment,
        input: {
          name: 'Test Server',
          description: 'A test server',
          metadata: { key: 'value' }
        }
      });

      expect(result.name).toBe('Test Server');
      expect(slugify).toHaveBeenCalledWith('Test Server-abc12');
    });

    it('should create server with empty metadata when not provided', async () => {
      const mockCreatedServer = { id: 'mcp_srv_123', metadata: {} };

      vi.mocked(withTransaction).mockImplementation(async (fn) => {
        const mockDb = {
          magicMcpServer: {
            create: vi.fn().mockImplementation((args: any) => {
              expect(args.data.metadata).toEqual({});
              return mockCreatedServer;
            })
          }
        };
        return fn(mockDb as any);
      });

      await magicMcpServerService.createMagicMcpServer({
        organization: mockOrganization,
        performedBy: mockPerformedBy,
        instance: mockInstance,
        context: mockContext,
        serverDeployment: mockServerDeployment,
        input: { name: 'Test' }
      });
    });

    it('should create server deployment association', async () => {
      const mockCreatedServer = { id: 'mcp_srv_123' };

      vi.mocked(withTransaction).mockImplementation(async (fn) => {
        const mockDb = {
          magicMcpServer: {
            create: vi.fn().mockImplementation((args: any) => {
              expect(args.data.serverDeployment).toBeDefined();
              expect(args.data.serverDeployment.create).toMatchObject({
                serverDeploymentOid: 'srv_dep_oid_1'
              });
              return mockCreatedServer;
            })
          }
        };
        return fn(mockDb as any);
      });

      await magicMcpServerService.createMagicMcpServer({
        organization: mockOrganization,
        performedBy: mockPerformedBy,
        instance: mockInstance,
        context: mockContext,
        serverDeployment: mockServerDeployment,
        input: { name: 'Test' }
      });
    });
  });

  describe('archiveMagicMcpServer', () => {
    it('should archive an active server', async () => {
      const mockServer = { id: 'mcp_srv_1', status: 'active' } as any;
      const mockArchivedServer = { id: 'mcp_srv_1', status: 'archived', deletedAt: expect.any(Date) };

      vi.mocked(db.magicMcpServer.update).mockResolvedValue(mockArchivedServer as any);

      const result = await magicMcpServerService.archiveMagicMcpServer({
        server: mockServer
      });

      expect(result.status).toBe('archived');
      expect(db.magicMcpServer.update).toHaveBeenCalledWith({
        where: { id: 'mcp_srv_1' },
        data: { status: 'archived', deletedAt: expect.any(Date) },
        include: expect.any(Object)
      });
    });

    it('should throw precondition failed error when server is already archived', async () => {
      const mockServer = { id: 'mcp_srv_1', status: 'archived' } as any;

      await expect(
        magicMcpServerService.archiveMagicMcpServer({
          server: mockServer
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should set deletedAt timestamp', async () => {
      const mockServer = { id: 'mcp_srv_1', status: 'active' } as any;
      const now = new Date();

      vi.mocked(db.magicMcpServer.update).mockImplementation(async (args: any) => {
        const deletedAt = args.data.deletedAt as Date;
        expect(deletedAt).toBeInstanceOf(Date);
        expect(deletedAt.getTime()).toBeGreaterThanOrEqual(now.getTime());
        return { id: 'mcp_srv_1', status: 'archived', deletedAt } as any;
      });

      await magicMcpServerService.archiveMagicMcpServer({
        server: mockServer
      });
    });
  });

  describe('updateMagicMcpServer', () => {
    it('should update server name and description', async () => {
      const mockServer = {
        id: 'mcp_srv_1',
        status: 'active',
        name: 'Old Name',
        description: 'Old Description',
        aliases: []
      } as any;

      const mockUpdatedServer = {
        id: 'mcp_srv_1',
        name: 'New Name',
        description: 'New Description'
      };

      vi.mocked(db.magicMcpServer.update).mockResolvedValue(mockUpdatedServer as any);

      const result = await magicMcpServerService.updateMagicMcpServer({
        server: mockServer,
        input: {
          name: 'New Name',
          description: 'New Description'
        }
      });

      expect(result.name).toBe('New Name');
      expect(result.description).toBe('New Description');
    });

    it('should throw error when updating archived server', async () => {
      const mockServer = {
        id: 'mcp_srv_1',
        status: 'archived',
        aliases: []
      } as any;

      await expect(
        magicMcpServerService.updateMagicMcpServer({
          server: mockServer,
          input: { name: 'New Name' }
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should add new aliases without removing existing ones', async () => {
      const mockServer = {
        id: 'mcp_srv_1',
        status: 'active',
        aliases: [{ slug: 'existing-alias' }]
      } as any;

      vi.mocked(db.magicMcpServer.update).mockImplementation(async (args: any) => {
        expect(args.data.aliases.create).toEqual([{ slug: 'new-alias' }]);
        return { id: 'mcp_srv_1' } as any;
      });

      await magicMcpServerService.updateMagicMcpServer({
        server: mockServer,
        input: {
          aliases: ['existing-alias', 'new-alias']
        }
      });
    });

    it('should slugify aliases with spaces', async () => {
      const mockServer = {
        id: 'mcp_srv_1',
        status: 'active',
        aliases: []
      } as any;

      vi.mocked(slugify).mockReturnValue('my-new-alias');
      vi.mocked(db.magicMcpServer.update).mockImplementation(async (args: any) => {
        expect(args.data.aliases.create).toEqual([{ slug: 'my-new-alias' }]);
        return { id: 'mcp_srv_1' } as any;
      });

      await magicMcpServerService.updateMagicMcpServer({
        server: mockServer,
        input: {
          aliases: ['My New Alias']
        }
      });

      expect(slugify).toHaveBeenCalledWith('My New Alias');
    });

    it('should not slugify aliases without spaces', async () => {
      const mockServer = {
        id: 'mcp_srv_1',
        status: 'active',
        aliases: []
      } as any;

      vi.mocked(db.magicMcpServer.update).mockImplementation(async (args: any) => {
        expect(args.data.aliases.create).toEqual([{ slug: 'my-alias' }]);
        return { id: 'mcp_srv_1' } as any;
      });

      await magicMcpServerService.updateMagicMcpServer({
        server: mockServer,
        input: {
          aliases: ['my-alias']
        }
      });
    });

    it('should update default OAuth session', async () => {
      const mockServer = {
        id: 'mcp_srv_1',
        status: 'active',
        aliases: []
      } as any;

      const mockOAuthSession = { oid: 'oauth_sess_oid_1' } as any;

      vi.mocked(db.magicMcpServer.update).mockImplementation(async (args: any) => {
        expect(args.data.defaultServerOauthSessionOid).toBe('oauth_sess_oid_1');
        return { id: 'mcp_srv_1' } as any;
      });

      await magicMcpServerService.updateMagicMcpServer({
        server: mockServer,
        input: {
          defaultOauthSession: mockOAuthSession
        }
      });
    });

    it('should preserve existing values when input is undefined', async () => {
      const mockServer = {
        id: 'mcp_srv_1',
        status: 'active',
        name: 'Original Name',
        description: 'Original Description',
        metadata: { key: 'value' },
        aliases: []
      } as any;

      vi.mocked(db.magicMcpServer.update).mockImplementation(async (args: any) => {
        expect(args.data.name).toBe('Original Name');
        expect(args.data.description).toBe('Original Description');
        expect(args.data.metadata).toEqual({ key: 'value' });
        return mockServer;
      });

      await magicMcpServerService.updateMagicMcpServer({
        server: mockServer,
        input: {}
      });
    });

    it('should allow setting fields to null explicitly', async () => {
      const mockServer = {
        id: 'mcp_srv_1',
        status: 'active',
        name: 'Original Name',
        description: 'Original Description',
        metadata: { key: 'value' },
        aliases: []
      } as any;

      vi.mocked(db.magicMcpServer.update).mockImplementation(async (args: any) => {
        expect(args.data.name).toBeNull();
        expect(args.data.description).toBeNull();
        expect(args.data.metadata).toBeNull();
        return mockServer;
      });

      await magicMcpServerService.updateMagicMcpServer({
        server: mockServer,
        input: {
          name: null,
          description: null,
          metadata: null
        }
      });
    });
  });

  describe('listMagicMcpServers', () => {
    it('should list servers with default filters', async () => {
      const mockServers = [
        { id: 'mcp_srv_1', name: 'Server 1', status: 'active' },
        { id: 'mcp_srv_2', name: 'Server 2', status: 'active' }
      ];

      vi.mocked(db.magicMcpServer.findMany).mockResolvedValue(mockServers as any);

      const result = await magicMcpServerService.listMagicMcpServers({
        instance: mockInstance
      });

      expect(result).toBeDefined();
    });

    it('should filter by status', async () => {
      vi.mocked(db.magicMcpServer.findMany).mockResolvedValue([]);

      await magicMcpServerService.listMagicMcpServers({
        instance: mockInstance,
        status: ['active']
      });

      expect(db.magicMcpServer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { status: { in: ['active'] } }
            ])
          })
        })
      );
    });

    it('should exclude archived servers by default', async () => {
      vi.mocked(db.magicMcpServer.findMany).mockResolvedValue([]);

      await magicMcpServerService.listMagicMcpServers({
        instance: mockInstance
      });

      expect(db.magicMcpServer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { status: { not: 'archived' } }
            ])
          })
        })
      );
    });

    it('should filter by search query', async () => {
      const mockSearchResults = [
        { id: 'mcp_srv_1' },
        { id: 'mcp_srv_2' }
      ];

      vi.mocked(searchService.search).mockResolvedValue(mockSearchResults as any);
      vi.mocked(db.magicMcpServer.findMany).mockResolvedValue([]);

      await magicMcpServerService.listMagicMcpServers({
        instance: mockInstance,
        search: 'test query'
      });

      expect(searchService.search).toHaveBeenCalledWith({
        index: 'magic_mcp_server',
        query: 'test query',
        options: {
          limit: 50
        }
      });

      expect(db.magicMcpServer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['mcp_srv_1', 'mcp_srv_2'] }
          })
        })
      );
    });

    it('should filter by server IDs', async () => {
      const mockServers = [{ oid: 'srv_oid_1' }];

      vi.mocked(db.server.findMany).mockResolvedValue(mockServers as any);
      vi.mocked(db.magicMcpServer.findMany).mockResolvedValue([]);

      await magicMcpServerService.listMagicMcpServers({
        instance: mockInstance,
        serverIds: ['srv_1']
      });

      expect(db.server.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['srv_1'] } }
      });

      expect(db.magicMcpServer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            serverDeployment: expect.objectContaining({
              serverDeployment: expect.objectContaining({
                serverOid: { in: ['srv_oid_1'] }
              })
            })
          })
        })
      );
    });

    it('should filter by server variant IDs', async () => {
      const mockVariants = [{ oid: 'srv_var_oid_1' }];

      vi.mocked(db.serverVariant.findMany).mockResolvedValue(mockVariants as any);
      vi.mocked(db.magicMcpServer.findMany).mockResolvedValue([]);

      await magicMcpServerService.listMagicMcpServers({
        instance: mockInstance,
        serverVariantIds: ['srv_var_1']
      });

      expect(db.serverVariant.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['srv_var_1'] } }
      });
    });

    it('should filter by server implementation IDs', async () => {
      const mockImplementations = [{ oid: 'srv_impl_oid_1' }];

      vi.mocked(db.serverImplementation.findMany).mockResolvedValue(mockImplementations as any);
      vi.mocked(db.magicMcpServer.findMany).mockResolvedValue([]);

      await magicMcpServerService.listMagicMcpServers({
        instance: mockInstance,
        serverImplementationIds: ['srv_impl_1']
      });

      expect(db.serverImplementation.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['srv_impl_1'] } }
      });
    });

    it('should filter by session IDs', async () => {
      const mockSessions = [{ oid: 'sess_oid_1' }];

      vi.mocked(db.session.findMany).mockResolvedValue(mockSessions as any);
      vi.mocked(db.magicMcpServer.findMany).mockResolvedValue([]);

      await magicMcpServerService.listMagicMcpServers({
        instance: mockInstance,
        sessionIds: ['sess_1']
      });

      expect(db.session.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['sess_1'] } }
      });
    });

    it('should handle empty results', async () => {
      vi.mocked(db.magicMcpServer.findMany).mockResolvedValue([]);

      await magicMcpServerService.listMagicMcpServers({
        instance: mockInstance
      });

      expect(db.magicMcpServer.findMany).toHaveBeenCalled();
    });

    it('should not filter by servers when empty array provided', async () => {
      vi.mocked(db.magicMcpServer.findMany).mockResolvedValue([]);

      await magicMcpServerService.listMagicMcpServers({
        instance: mockInstance,
        serverIds: []
      });

      expect(db.server.findMany).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle server with special characters in name', async () => {
      vi.mocked(slugify).mockReturnValue('special-chars-server-abc12');

      vi.mocked(withTransaction).mockImplementation(async (fn) => {
        const mockDb = {
          magicMcpServer: {
            create: vi.fn().mockResolvedValue({ id: 'mcp_srv_123' })
          }
        };
        return fn(mockDb as any);
      });

      await magicMcpServerService.createMagicMcpServer({
        organization: mockOrganization,
        performedBy: mockPerformedBy,
        instance: mockInstance,
        context: mockContext,
        serverDeployment: mockServerDeployment,
        input: { name: 'Special @#$ Chars Server!' }
      });

      expect(slugify).toHaveBeenCalled();
    });

    it('should handle updating server with empty aliases array', async () => {
      const mockServer = {
        id: 'mcp_srv_1',
        status: 'active',
        aliases: [{ slug: 'existing' }]
      } as any;

      vi.mocked(db.magicMcpServer.update).mockImplementation(async (args: any) => {
        expect(args.data.aliases.create).toEqual([]);
        return { id: 'mcp_srv_1' } as any;
      });

      await magicMcpServerService.updateMagicMcpServer({
        server: mockServer,
        input: { aliases: [] }
      });
    });
  });
});
