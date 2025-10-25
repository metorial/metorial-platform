import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serverRunErrorService } from '../src/services/serverRunError';

// Mock dependencies
vi.mock('@metorial/db', () => ({
  db: {
    serverRunError: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    serverSession: {
      findMany: vi.fn()
    },
    serverDeployment: {
      findMany: vi.fn()
    },
    serverImplementation: {
      findMany: vi.fn()
    },
    serverRunErrorGroup: {
      findMany: vi.fn()
    },
    serverRun: {
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

describe('serverRunErrorService', () => {
  let db: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const dbModule = await import('@metorial/db');
    db = dbModule.db;
  });

  describe('getServerRunErrorById', () => {
    const mockInstance = {
      oid: 1,
      id: 'inst_123'
    };

    it('should return server run error when found', async () => {
      const mockServerRunError = {
        oid: 1,
        id: 'err_123',
        instanceOid: 1,
        message: 'Test error',
        serverRun: {
          oid: 10,
          serverDeployment: {
            server: { id: 'srv_1', name: 'Test Server' }
          },
          serverVersion: { id: 'ver_1' },
          serverSession: {
            session: { id: 'ses_1' }
          }
        }
      };

      db.serverRunError.findFirst.mockResolvedValue(mockServerRunError);

      const result = await serverRunErrorService.getServerRunErrorById({
        instance: mockInstance as any,
        serverRunErrorId: 'err_123'
      });

      expect(result).toEqual(mockServerRunError);
      expect(db.serverRunError.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'err_123',
          instanceOid: 1
        },
        include: expect.any(Object)
      });
    });

    it('should throw ServiceError when server run error not found', async () => {
      db.serverRunError.findFirst.mockResolvedValue(null);

      await expect(
        serverRunErrorService.getServerRunErrorById({
          instance: mockInstance as any,
          serverRunErrorId: 'err_nonexistent'
        })
      ).rejects.toThrow();

      expect(db.serverRunError.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'err_nonexistent',
          instanceOid: 1
        },
        include: expect.any(Object)
      });
    });

    it('should include proper relations in query', async () => {
      const mockServerRunError = {
        oid: 1,
        id: 'err_123',
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
      };

      db.serverRunError.findFirst.mockResolvedValue(mockServerRunError);

      await serverRunErrorService.getServerRunErrorById({
        instance: mockInstance as any,
        serverRunErrorId: 'err_123'
      });

      expect(db.serverRunError.findFirst).toHaveBeenCalledWith({
        where: expect.any(Object),
        include: expect.objectContaining({
          serverRun: expect.any(Object)
        })
      });
    });
  });

  describe('listServerRunErrors', () => {
    const mockInstance = {
      oid: 1,
      id: 'inst_123'
    };

    it('should return paginator for all server run errors without filters', async () => {
      db.serverRunError.findMany.mockResolvedValue([]);

      const result = await serverRunErrorService.listServerRunErrors({
        instance: mockInstance as any
      });

      expect(result).toBeDefined();
      expect(result.__isPaginator).toBe(true);
    });

    it('should filter by serverSessionIds when provided', async () => {
      const mockServerSessions = [{ oid: 20, id: 'ss_1' }];
      db.serverSession.findMany.mockResolvedValue(mockServerSessions);
      db.serverRunError.findMany.mockResolvedValue([]);

      await serverRunErrorService.listServerRunErrors({
        instance: mockInstance as any,
        serverSessionIds: ['ss_1']
      });

      expect(db.serverSession.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['ss_1'] }, instanceOid: 1 }
      });
    });

    it('should filter by serverDeploymentIds when provided', async () => {
      const mockDeployments = [{ oid: 30, id: 'dep_1' }];
      db.serverDeployment.findMany.mockResolvedValue(mockDeployments);
      db.serverRunError.findMany.mockResolvedValue([]);

      await serverRunErrorService.listServerRunErrors({
        instance: mockInstance as any,
        serverDeploymentIds: ['dep_1']
      });

      expect(db.serverDeployment.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['dep_1'] }, instanceOid: 1 }
      });
    });

    it('should filter by serverImplementationIds when provided', async () => {
      const mockImplementations = [{ oid: 40, id: 'impl_1' }];
      db.serverImplementation.findMany.mockResolvedValue(mockImplementations);
      db.serverRunError.findMany.mockResolvedValue([]);

      await serverRunErrorService.listServerRunErrors({
        instance: mockInstance as any,
        serverImplementationIds: ['impl_1']
      });

      expect(db.serverImplementation.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['impl_1'] }, instanceOid: 1 }
      });
    });

    it('should filter by serverRunErrorGroupIds when provided', async () => {
      const mockErrorGroups = [{ oid: 50, id: 'eg_1' }];
      db.serverRunErrorGroup.findMany.mockResolvedValue(mockErrorGroups);
      db.serverRunError.findMany.mockResolvedValue([]);

      await serverRunErrorService.listServerRunErrors({
        instance: mockInstance as any,
        serverRunErrorGroupIds: ['eg_1']
      });

      expect(db.serverRunErrorGroup.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['eg_1'] }, instanceOid: 1 }
      });
    });

    it('should filter by serverRunIds when provided', async () => {
      const mockServerRuns = [{ oid: 60, id: 'run_1' }];
      db.serverRun.findMany.mockResolvedValue(mockServerRuns);
      db.serverRunError.findMany.mockResolvedValue([]);

      await serverRunErrorService.listServerRunErrors({
        instance: mockInstance as any,
        serverRunIds: ['run_1']
      });

      expect(db.serverRun.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['run_1'] }, instanceOid: 1 }
      });
    });

    it('should handle multiple filters simultaneously', async () => {
      const mockServerSessions = [{ oid: 20, id: 'ss_1' }];
      const mockDeployments = [{ oid: 30, id: 'dep_1' }];
      const mockServerRuns = [{ oid: 60, id: 'run_1' }];

      db.serverSession.findMany.mockResolvedValue(mockServerSessions);
      db.serverDeployment.findMany.mockResolvedValue(mockDeployments);
      db.serverRun.findMany.mockResolvedValue(mockServerRuns);
      db.serverRunError.findMany.mockResolvedValue([]);

      await serverRunErrorService.listServerRunErrors({
        instance: mockInstance as any,
        serverSessionIds: ['ss_1'],
        serverDeploymentIds: ['dep_1'],
        serverRunIds: ['run_1']
      });

      expect(db.serverSession.findMany).toHaveBeenCalled();
      expect(db.serverDeployment.findMany).toHaveBeenCalled();
      expect(db.serverRun.findMany).toHaveBeenCalled();
    });

    it('should not query related entities when no IDs provided', async () => {
      db.serverRunError.findMany.mockResolvedValue([]);

      await serverRunErrorService.listServerRunErrors({
        instance: mockInstance as any
      });

      expect(db.serverSession.findMany).not.toHaveBeenCalled();
      expect(db.serverDeployment.findMany).not.toHaveBeenCalled();
      expect(db.serverImplementation.findMany).not.toHaveBeenCalled();
      expect(db.serverRunErrorGroup.findMany).not.toHaveBeenCalled();
      expect(db.serverRun.findMany).not.toHaveBeenCalled();
    });

    it('should handle empty arrays for filter IDs', async () => {
      db.serverRunError.findMany.mockResolvedValue([]);

      await serverRunErrorService.listServerRunErrors({
        instance: mockInstance as any,
        serverSessionIds: [],
        serverDeploymentIds: []
      });

      expect(db.serverSession.findMany).not.toHaveBeenCalled();
      expect(db.serverDeployment.findMany).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    const mockInstance = {
      oid: 1,
      id: 'inst_123'
    };

    it('should handle very long error IDs', async () => {
      const longId = 'err_' + 'a'.repeat(1000);
      db.serverRunError.findFirst.mockResolvedValue(null);

      await expect(
        serverRunErrorService.getServerRunErrorById({
          instance: mockInstance as any,
          serverRunErrorId: longId
        })
      ).rejects.toThrow();

      expect(db.serverRunError.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: longId
          })
        })
      );
    });

    it('should handle special characters in IDs', async () => {
      const specialId = 'err_<script>alert("xss")</script>';
      db.serverRunError.findFirst.mockResolvedValue(null);

      await expect(
        serverRunErrorService.getServerRunErrorById({
          instance: mockInstance as any,
          serverRunErrorId: specialId
        })
      ).rejects.toThrow();
    });

    it('should handle null instance oid gracefully', async () => {
      const instanceWithNullOid = {
        oid: null,
        id: 'inst_123'
      };
      db.serverRunError.findFirst.mockResolvedValue(null);

      await expect(
        serverRunErrorService.getServerRunErrorById({
          instance: instanceWithNullOid as any,
          serverRunErrorId: 'err_123'
        })
      ).rejects.toThrow();
    });
  });
});
