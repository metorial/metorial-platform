import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serverRunService } from '../src/services/serverRun';

// Mock dependencies
vi.mock('@metorial/db', () => ({
  db: {
    serverRun: {
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
    session: {
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

describe('serverRunService', () => {
  let db: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const dbModule = await import('@metorial/db');
    db = dbModule.db;
  });

  describe('getServerRunById', () => {
    const mockInstance = {
      oid: 1,
      id: 'inst_123'
    };

    it('should return server run when found', async () => {
      const mockServerRun = {
        oid: 1,
        id: 'run_123',
        instanceOid: 1,
        status: 'running',
        serverDeployment: {
          server: { id: 'srv_1', name: 'Test Server' }
        },
        serverVersion: { id: 'ver_1' },
        serverSession: {
          session: { id: 'ses_1' }
        }
      };

      db.serverRun.findFirst.mockResolvedValue(mockServerRun);

      const result = await serverRunService.getServerRunById({
        instance: mockInstance as any,
        serverRunId: 'run_123'
      });

      expect(result).toEqual(mockServerRun);
      expect(db.serverRun.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'run_123',
          instanceOid: 1
        },
        include: expect.any(Object)
      });
    });

    it('should throw ServiceError when server run not found', async () => {
      db.serverRun.findFirst.mockResolvedValue(null);

      await expect(
        serverRunService.getServerRunById({
          instance: mockInstance as any,
          serverRunId: 'run_nonexistent'
        })
      ).rejects.toThrow();

      expect(db.serverRun.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'run_nonexistent',
          instanceOid: 1
        },
        include: expect.any(Object)
      });
    });

    it('should include proper relations in query', async () => {
      const mockServerRun = {
        oid: 1,
        id: 'run_123',
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
      };

      db.serverRun.findFirst.mockResolvedValue(mockServerRun);

      await serverRunService.getServerRunById({
        instance: mockInstance as any,
        serverRunId: 'run_123'
      });

      expect(db.serverRun.findFirst).toHaveBeenCalledWith({
        where: expect.any(Object),
        include: expect.objectContaining({
          serverDeployment: expect.any(Object),
          serverVersion: expect.any(Boolean),
          serverSession: expect.any(Object)
        })
      });
    });
  });

  describe('listServerRuns', () => {
    const mockInstance = {
      oid: 1,
      id: 'inst_123'
    };

    it('should return paginator for all server runs without filters', async () => {
      db.serverRun.findMany.mockResolvedValue([]);

      const result = await serverRunService.listServerRuns({
        instance: mockInstance as any
      });

      expect(result).toBeDefined();
      expect(result.__isPaginator).toBe(true);
    });

    it('should filter by status when provided', async () => {
      db.serverRun.findMany.mockResolvedValue([]);

      const paginator = await serverRunService.listServerRuns({
        instance: mockInstance as any,
        status: ['running', 'completed']
      });

      expect(paginator).toBeDefined();
    });

    it('should filter by sessionIds when provided', async () => {
      const mockSessions = [{ oid: 10, id: 'ses_1' }];
      db.session.findMany.mockResolvedValue(mockSessions);
      db.serverRun.findMany.mockResolvedValue([]);

      await serverRunService.listServerRuns({
        instance: mockInstance as any,
        sessionIds: ['ses_1']
      });

      expect(db.session.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['ses_1'] }, instanceOid: 1 }
      });
    });

    it('should filter by serverSessionIds when provided', async () => {
      const mockServerSessions = [{ oid: 20, id: 'ss_1' }];
      db.serverSession.findMany.mockResolvedValue(mockServerSessions);
      db.serverRun.findMany.mockResolvedValue([]);

      await serverRunService.listServerRuns({
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
      db.serverRun.findMany.mockResolvedValue([]);

      await serverRunService.listServerRuns({
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
      db.serverRun.findMany.mockResolvedValue([]);

      await serverRunService.listServerRuns({
        instance: mockInstance as any,
        serverImplementationIds: ['impl_1']
      });

      expect(db.serverImplementation.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['impl_1'] }, instanceOid: 1 }
      });
    });

    it('should handle multiple filters simultaneously', async () => {
      const mockSessions = [{ oid: 10, id: 'ses_1' }];
      const mockServerSessions = [{ oid: 20, id: 'ss_1' }];

      db.session.findMany.mockResolvedValue(mockSessions);
      db.serverSession.findMany.mockResolvedValue(mockServerSessions);
      db.serverRun.findMany.mockResolvedValue([]);

      await serverRunService.listServerRuns({
        instance: mockInstance as any,
        status: ['running'],
        sessionIds: ['ses_1'],
        serverSessionIds: ['ss_1']
      });

      expect(db.session.findMany).toHaveBeenCalled();
      expect(db.serverSession.findMany).toHaveBeenCalled();
    });

    it('should not query related entities when no IDs provided', async () => {
      db.serverRun.findMany.mockResolvedValue([]);

      await serverRunService.listServerRuns({
        instance: mockInstance as any
      });

      expect(db.session.findMany).not.toHaveBeenCalled();
      expect(db.serverSession.findMany).not.toHaveBeenCalled();
      expect(db.serverDeployment.findMany).not.toHaveBeenCalled();
      expect(db.serverImplementation.findMany).not.toHaveBeenCalled();
    });

    it('should handle empty arrays for filter IDs', async () => {
      db.serverRun.findMany.mockResolvedValue([]);

      await serverRunService.listServerRuns({
        instance: mockInstance as any,
        sessionIds: [],
        serverSessionIds: []
      });

      expect(db.session.findMany).not.toHaveBeenCalled();
      expect(db.serverSession.findMany).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    const mockInstance = {
      oid: 1,
      id: 'inst_123'
    };

    it('should handle very long server run IDs', async () => {
      const longId = 'run_' + 'a'.repeat(1000);
      db.serverRun.findFirst.mockResolvedValue(null);

      await expect(
        serverRunService.getServerRunById({
          instance: mockInstance as any,
          serverRunId: longId
        })
      ).rejects.toThrow();

      expect(db.serverRun.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: longId
          })
        })
      );
    });

    it('should handle special characters in IDs', async () => {
      const specialId = 'run_<script>alert("xss")</script>';
      db.serverRun.findFirst.mockResolvedValue(null);

      await expect(
        serverRunService.getServerRunById({
          instance: mockInstance as any,
          serverRunId: specialId
        })
      ).rejects.toThrow();
    });
  });
});
