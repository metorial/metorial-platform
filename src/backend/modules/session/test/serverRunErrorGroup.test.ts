import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serverRunErrorGroupService } from '../src/services/serverRunErrorGroup';

// Mock dependencies
vi.mock('@metorial/db', () => ({
  db: {
    serverRunErrorGroup: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    server: {
      findMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/error', () => ({
  notFoundError: vi.fn((msg) => ({ code: 'not_found', message: msg })),
  ServiceError: class ServiceError extends Error {
    constructor(public error: any) {
      super(error.message);
    }
  }
}));

vi.mock('@metorial/pagination', () => ({
  Paginator: {
    create: vi.fn((fn) => ({
      prisma: fn,
      __isPaginator: true
    }))
  }
}));

vi.mock('@metorial/service', () => ({
  Service: {
    create: vi.fn((name, factory) => ({
      build: () => factory()
    }))
  }
}));

describe('serverRunErrorGroupService', () => {
  let db: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const dbModule = await import('@metorial/db');
    db = dbModule.db;
  });

  describe('getServerRunErrorGroupById', () => {
    const mockInstance = {
      oid: 1,
      id: 'inst_123'
    };

    it('should return server run error group when found', async () => {
      const mockErrorGroup = {
        oid: 1,
        id: 'eg_123',
        instanceOid: 1,
        hash: 'hash_abc',
        count: 5,
        defaultServerRunError: {
          oid: 10,
          message: 'Sample error',
          serverRun: {
            oid: 20,
            serverDeployment: {
              server: { id: 'srv_1', name: 'Test Server' }
            },
            serverVersion: { id: 'ver_1' },
            serverSession: {
              session: { id: 'ses_1' }
            }
          }
        }
      };

      db.serverRunErrorGroup.findFirst.mockResolvedValue(mockErrorGroup);

      const result = await serverRunErrorGroupService.getServerRunErrorGroupById({
        instance: mockInstance as any,
        serverRunErrorGroupId: 'eg_123'
      });

      expect(result).toEqual(mockErrorGroup);
      expect(db.serverRunErrorGroup.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'eg_123',
          instanceOid: 1
        },
        include: expect.any(Object)
      });
    });

    it('should throw ServiceError when error group not found', async () => {
      db.serverRunErrorGroup.findFirst.mockResolvedValue(null);

      await expect(
        serverRunErrorGroupService.getServerRunErrorGroupById({
          instance: mockInstance as any,
          serverRunErrorGroupId: 'eg_nonexistent'
        })
      ).rejects.toThrow();

      expect(db.serverRunErrorGroup.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'eg_nonexistent',
          instanceOid: 1
        },
        include: expect.any(Object)
      });
    });

    it('should include proper relations in query', async () => {
      const mockErrorGroup = {
        oid: 1,
        id: 'eg_123',
        defaultServerRunError: {
          include: {
            serverRun: {
              include: {
                serverDeployment: {
                  include: {
                    server: true
                  }
                },
                serverVersion: true,
                serverSession: {
                  include: {
                    session: true
                  }
                }
              }
            }
          }
        }
      };

      db.serverRunErrorGroup.findFirst.mockResolvedValue(mockErrorGroup);

      await serverRunErrorGroupService.getServerRunErrorGroupById({
        instance: mockInstance as any,
        serverRunErrorGroupId: 'eg_123'
      });

      expect(db.serverRunErrorGroup.findFirst).toHaveBeenCalledWith({
        where: expect.any(Object),
        include: expect.objectContaining({
          defaultServerRunError: expect.any(Object)
        })
      });
    });
  });

  describe('listServerRunErrorGroups', () => {
    const mockInstance = {
      oid: 1,
      id: 'inst_123'
    };

    it('should return paginator for all error groups without filters', async () => {
      db.serverRunErrorGroup.findMany.mockResolvedValue([]);

      const result = await serverRunErrorGroupService.listServerRunErrorGroups({
        instance: mockInstance as any
      });

      expect(result).toBeDefined();
      expect(result.__isPaginator).toBe(true);
    });

    it('should filter by serverIds when provided', async () => {
      const mockServers = [{ oid: 10, id: 'srv_1' }];
      db.server.findMany.mockResolvedValue(mockServers);
      db.serverRunErrorGroup.findMany.mockResolvedValue([]);

      await serverRunErrorGroupService.listServerRunErrorGroups({
        instance: mockInstance as any,
        serverIds: ['srv_1']
      });

      expect(db.server.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['srv_1'] } }
      });
    });

    it('should not query servers when no IDs provided', async () => {
      db.serverRunErrorGroup.findMany.mockResolvedValue([]);

      await serverRunErrorGroupService.listServerRunErrorGroups({
        instance: mockInstance as any
      });

      expect(db.server.findMany).not.toHaveBeenCalled();
    });

    it('should handle empty arrays for server IDs', async () => {
      db.serverRunErrorGroup.findMany.mockResolvedValue([]);

      await serverRunErrorGroupService.listServerRunErrorGroups({
        instance: mockInstance as any,
        serverIds: []
      });

      expect(db.server.findMany).not.toHaveBeenCalled();
    });

    it('should handle multiple server IDs', async () => {
      const mockServers = [
        { oid: 10, id: 'srv_1' },
        { oid: 20, id: 'srv_2' },
        { oid: 30, id: 'srv_3' }
      ];
      db.server.findMany.mockResolvedValue(mockServers);
      db.serverRunErrorGroup.findMany.mockResolvedValue([]);

      await serverRunErrorGroupService.listServerRunErrorGroups({
        instance: mockInstance as any,
        serverIds: ['srv_1', 'srv_2', 'srv_3']
      });

      expect(db.server.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['srv_1', 'srv_2', 'srv_3'] } }
      });
    });
  });

  describe('edge cases', () => {
    const mockInstance = {
      oid: 1,
      id: 'inst_123'
    };

    it('should handle very long error group IDs', async () => {
      const longId = 'eg_' + 'a'.repeat(1000);
      db.serverRunErrorGroup.findFirst.mockResolvedValue(null);

      await expect(
        serverRunErrorGroupService.getServerRunErrorGroupById({
          instance: mockInstance as any,
          serverRunErrorGroupId: longId
        })
      ).rejects.toThrow();

      expect(db.serverRunErrorGroup.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: longId
          })
        })
      );
    });

    it('should handle special characters in IDs', async () => {
      const specialId = 'eg_<script>alert("xss")</script>';
      db.serverRunErrorGroup.findFirst.mockResolvedValue(null);

      await expect(
        serverRunErrorGroupService.getServerRunErrorGroupById({
          instance: mockInstance as any,
          serverRunErrorGroupId: specialId
        })
      ).rejects.toThrow();
    });

    it('should handle Unicode characters in IDs', async () => {
      const unicodeId = 'eg_测试_😀';
      db.serverRunErrorGroup.findFirst.mockResolvedValue(null);

      await expect(
        serverRunErrorGroupService.getServerRunErrorGroupById({
          instance: mockInstance as any,
          serverRunErrorGroupId: unicodeId
        })
      ).rejects.toThrow();
    });

    it('should handle large numbers of server IDs in filter', async () => {
      const manyServerIds = Array.from({ length: 1000 }, (_, i) => `srv_${i}`);
      const mockServers = manyServerIds.map((id, i) => ({ oid: i, id }));
      db.server.findMany.mockResolvedValue(mockServers);
      db.serverRunErrorGroup.findMany.mockResolvedValue([]);

      await serverRunErrorGroupService.listServerRunErrorGroups({
        instance: mockInstance as any,
        serverIds: manyServerIds
      });

      expect(db.server.findMany).toHaveBeenCalledWith({
        where: { id: { in: manyServerIds } }
      });
    });
  });
});
