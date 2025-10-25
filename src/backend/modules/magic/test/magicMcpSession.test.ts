import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceError, notFoundError } from '@metorial/error';
import { magicMcpSessionService } from '../src/services/magicMcpSession';

// Mock external dependencies
vi.mock('@metorial/db', () => ({
  db: {
    magicMcpSession: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    magicMcpServer: {
      findMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/pagination', () => ({
  Paginator: {
    create: vi.fn(fn => fn({ prisma: (cb: any) => cb({}) }))
  }
}));

import { db } from '@metorial/db';

const mockInstance = { oid: 'inst_oid_1', id: 'inst_1' } as any;

describe('magicMcpSessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMagicMcpSessionById', () => {
    it('should return session by ID', async () => {
      const mockSession = {
        id: 'mcp_sess_1',
        magicMcpServer: { id: 'mcp_srv_1' },
        session: { id: 'sess_1', serverSessions: [] }
      };
      vi.mocked(db.magicMcpSession.findFirst).mockResolvedValue(mockSession as any);

      const result = await magicMcpSessionService.getMagicMcpSessionById({
        instance: mockInstance,
        magicMcpSessionId: 'mcp_sess_1'
      });

      expect(result).toEqual(mockSession);
      expect(db.magicMcpSession.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'mcp_sess_1',
          instanceOid: 'inst_oid_1'
        },
        include: {
          magicMcpServer: true,
          session: {
            include: {
              serverSessions: true
            }
          }
        }
      });
    });

    it('should throw not found error when session does not exist', async () => {
      vi.mocked(db.magicMcpSession.findFirst).mockResolvedValue(null);

      await expect(
        magicMcpSessionService.getMagicMcpSessionById({
          instance: mockInstance,
          magicMcpSessionId: 'nonexistent'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should filter by instance OID', async () => {
      vi.mocked(db.magicMcpSession.findFirst).mockResolvedValue(null);

      await expect(
        magicMcpSessionService.getMagicMcpSessionById({
          instance: mockInstance,
          magicMcpSessionId: 'mcp_sess_1'
        })
      ).rejects.toThrow();

      expect(db.magicMcpSession.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            instanceOid: 'inst_oid_1'
          })
        })
      );
    });

    it('should include related data in response', async () => {
      const mockSession = {
        id: 'mcp_sess_1',
        magicMcpServer: { id: 'mcp_srv_1', name: 'Test Server' },
        session: {
          id: 'sess_1',
          serverSessions: [{ id: 'srv_sess_1' }]
        }
      };
      vi.mocked(db.magicMcpSession.findFirst).mockResolvedValue(mockSession as any);

      const result = await magicMcpSessionService.getMagicMcpSessionById({
        instance: mockInstance,
        magicMcpSessionId: 'mcp_sess_1'
      });

      expect(result.magicMcpServer).toEqual(mockSession.magicMcpServer);
      expect(result.session).toEqual(mockSession.session);
    });
  });

  describe('getManyMagicMcpSessions', () => {
    it('should return multiple sessions by IDs', async () => {
      const mockSessions = [
        {
          id: 'mcp_sess_1',
          magicMcpServer: { id: 'mcp_srv_1' },
          session: { id: 'sess_1', serverSessions: [] }
        },
        {
          id: 'mcp_sess_2',
          magicMcpServer: { id: 'mcp_srv_1' },
          session: { id: 'sess_2', serverSessions: [] }
        }
      ];
      vi.mocked(db.magicMcpSession.findMany).mockResolvedValue(mockSessions as any);

      const result = await magicMcpSessionService.getManyMagicMcpSessions({
        magicMcpSessionId: ['mcp_sess_1', 'mcp_sess_2'],
        instance: mockInstance
      });

      expect(result).toEqual(mockSessions);
      expect(db.magicMcpSession.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['mcp_sess_1', 'mcp_sess_2'] },
          instanceOid: 'inst_oid_1'
        },
        include: {
          magicMcpServer: true,
          session: {
            include: {
              serverSessions: true
            }
          }
        }
      });
    });

    it('should return empty array when no IDs provided', async () => {
      const result = await magicMcpSessionService.getManyMagicMcpSessions({
        magicMcpSessionId: [],
        instance: mockInstance
      });

      expect(result).toEqual([]);
      expect(db.magicMcpSession.findMany).not.toHaveBeenCalled();
    });

    it('should filter by instance', async () => {
      vi.mocked(db.magicMcpSession.findMany).mockResolvedValue([]);

      await magicMcpSessionService.getManyMagicMcpSessions({
        magicMcpSessionId: ['mcp_sess_1'],
        instance: mockInstance
      });

      expect(db.magicMcpSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            instanceOid: 'inst_oid_1'
          })
        })
      );
    });

    it('should handle single session ID', async () => {
      const mockSession = {
        id: 'mcp_sess_1',
        magicMcpServer: { id: 'mcp_srv_1' },
        session: { id: 'sess_1', serverSessions: [] }
      };
      vi.mocked(db.magicMcpSession.findMany).mockResolvedValue([mockSession] as any);

      const result = await magicMcpSessionService.getManyMagicMcpSessions({
        magicMcpSessionId: ['mcp_sess_1'],
        instance: mockInstance
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockSession);
    });

    it('should return empty array when sessions not found', async () => {
      vi.mocked(db.magicMcpSession.findMany).mockResolvedValue([]);

      const result = await magicMcpSessionService.getManyMagicMcpSessions({
        magicMcpSessionId: ['nonexistent'],
        instance: mockInstance
      });

      expect(result).toEqual([]);
    });
  });

  describe('listMagicMcpSessions', () => {
    it('should list all sessions for an instance', async () => {
      const mockSessions = [
        {
          id: 'mcp_sess_1',
          magicMcpServer: { id: 'mcp_srv_1' },
          session: { id: 'sess_1', serverSessions: [] }
        }
      ];

      vi.mocked(db.magicMcpSession.findMany).mockResolvedValue(mockSessions as any);

      const result = await magicMcpSessionService.listMagicMcpSessions({
        instance: mockInstance
      });

      expect(result).toBeDefined();
      expect(db.magicMcpSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            instanceOid: 'inst_oid_1',
            AND: []
          },
          include: {
            magicMcpServer: true,
            session: {
              include: {
                serverSessions: true
              }
            }
          }
        })
      );
    });

    it('should filter by magic MCP server IDs', async () => {
      const mockServers = [
        { id: 'mcp_srv_1', oid: 'mcp_srv_oid_1' },
        { id: 'mcp_srv_2', oid: 'mcp_srv_oid_2' }
      ];

      vi.mocked(db.magicMcpServer.findMany).mockResolvedValue(mockServers as any);
      vi.mocked(db.magicMcpSession.findMany).mockResolvedValue([]);

      await magicMcpSessionService.listMagicMcpSessions({
        instance: mockInstance,
        magicMcpServerId: ['mcp_srv_1', 'mcp_srv_2']
      });

      expect(db.magicMcpServer.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['mcp_srv_1', 'mcp_srv_2'] },
          instanceOid: 'inst_oid_1'
        }
      });

      expect(db.magicMcpSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: [
              { magicMcpServerOid: { in: ['mcp_srv_oid_1', 'mcp_srv_oid_2'] } }
            ]
          })
        })
      );
    });

    it('should not filter by server when no server IDs provided', async () => {
      vi.mocked(db.magicMcpSession.findMany).mockResolvedValue([]);

      await magicMcpSessionService.listMagicMcpSessions({
        instance: mockInstance
      });

      expect(db.magicMcpServer.findMany).not.toHaveBeenCalled();
      expect(db.magicMcpSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: []
          })
        })
      );
    });

    it('should not filter by server when empty array provided', async () => {
      vi.mocked(db.magicMcpSession.findMany).mockResolvedValue([]);

      await magicMcpSessionService.listMagicMcpSessions({
        instance: mockInstance,
        magicMcpServerId: []
      });

      expect(db.magicMcpServer.findMany).not.toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      vi.mocked(db.magicMcpSession.findMany).mockResolvedValue([]);

      await magicMcpSessionService.listMagicMcpSessions({
        instance: mockInstance
      });

      expect(db.magicMcpSession.findMany).toHaveBeenCalled();
    });

    it('should include all related data in results', async () => {
      const mockSessions = [
        {
          id: 'mcp_sess_1',
          magicMcpServer: {
            id: 'mcp_srv_1',
            name: 'Test Server'
          },
          session: {
            id: 'sess_1',
            serverSessions: [
              { id: 'srv_sess_1', status: 'active' }
            ]
          }
        }
      ];

      vi.mocked(db.magicMcpSession.findMany).mockResolvedValue(mockSessions as any);

      await magicMcpSessionService.listMagicMcpSessions({
        instance: mockInstance
      });

      expect(db.magicMcpSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            magicMcpServer: true,
            session: expect.objectContaining({
              include: expect.objectContaining({
                serverSessions: true
              })
            })
          })
        })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle session with multiple server sessions', async () => {
      const mockSession = {
        id: 'mcp_sess_1',
        magicMcpServer: { id: 'mcp_srv_1' },
        session: {
          id: 'sess_1',
          serverSessions: [
            { id: 'srv_sess_1' },
            { id: 'srv_sess_2' },
            { id: 'srv_sess_3' }
          ]
        }
      };
      vi.mocked(db.magicMcpSession.findFirst).mockResolvedValue(mockSession as any);

      const result = await magicMcpSessionService.getMagicMcpSessionById({
        instance: mockInstance,
        magicMcpSessionId: 'mcp_sess_1'
      });

      expect(result.session.serverSessions).toHaveLength(3);
    });

    it('should handle session with no server sessions', async () => {
      const mockSession = {
        id: 'mcp_sess_1',
        magicMcpServer: { id: 'mcp_srv_1' },
        session: {
          id: 'sess_1',
          serverSessions: []
        }
      };
      vi.mocked(db.magicMcpSession.findFirst).mockResolvedValue(mockSession as any);

      const result = await magicMcpSessionService.getMagicMcpSessionById({
        instance: mockInstance,
        magicMcpSessionId: 'mcp_sess_1'
      });

      expect(result.session.serverSessions).toEqual([]);
    });

    it('should handle listing with multiple server filters', async () => {
      const mockServers = [
        { id: 'mcp_srv_1', oid: 'mcp_srv_oid_1' },
        { id: 'mcp_srv_2', oid: 'mcp_srv_oid_2' },
        { id: 'mcp_srv_3', oid: 'mcp_srv_oid_3' }
      ];

      vi.mocked(db.magicMcpServer.findMany).mockResolvedValue(mockServers as any);
      vi.mocked(db.magicMcpSession.findMany).mockResolvedValue([]);

      await magicMcpSessionService.listMagicMcpSessions({
        instance: mockInstance,
        magicMcpServerId: ['mcp_srv_1', 'mcp_srv_2', 'mcp_srv_3']
      });

      expect(db.magicMcpSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: [
              {
                magicMcpServerOid: {
                  in: ['mcp_srv_oid_1', 'mcp_srv_oid_2', 'mcp_srv_oid_3']
                }
              }
            ]
          })
        })
      );
    });

    it('should handle different instance contexts', async () => {
      const differentInstance = { oid: 'inst_oid_2', id: 'inst_2' } as any;
      vi.mocked(db.magicMcpSession.findFirst).mockResolvedValue(null);

      await expect(
        magicMcpSessionService.getMagicMcpSessionById({
          instance: differentInstance,
          magicMcpSessionId: 'mcp_sess_1'
        })
      ).rejects.toThrow();

      expect(db.magicMcpSession.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            instanceOid: 'inst_oid_2'
          })
        })
      );
    });

    it('should preserve all session data fields', async () => {
      const mockSession = {
        id: 'mcp_sess_1',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        magicMcpServer: { id: 'mcp_srv_1' },
        session: {
          id: 'sess_1',
          name: 'Test Session',
          serverSessions: []
        },
        customField: 'custom value'
      };
      vi.mocked(db.magicMcpSession.findFirst).mockResolvedValue(mockSession as any);

      const result = await magicMcpSessionService.getMagicMcpSessionById({
        instance: mockInstance,
        magicMcpSessionId: 'mcp_sess_1'
      });

      expect(result).toEqual(mockSession);
    });
  });
});
