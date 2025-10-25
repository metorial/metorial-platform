import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sessionEventService } from '../src/services/sessionEvent';

// Mock dependencies
vi.mock('@metorial/db', () => ({
  db: {
    sessionEvent: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    serverRun: {
      findMany: vi.fn()
    },
    serverSession: {
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

describe('sessionEventService', () => {
  let db: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const dbModule = await import('@metorial/db');
    db = dbModule.db;
  });

  describe('getSessionEventById', () => {
    const mockSession = {
      oid: 1,
      id: 'ses_123'
    };

    it('should return session event when found', async () => {
      const mockEvent = {
        oid: 1,
        id: 'evt_123',
        sessionOid: 1,
        type: 'server_logs',
        serverRun: {
          id: 'run_1',
          serverVersion: { id: 'ver_1' },
          serverDeployment: {
            id: 'dep_1',
            server: { id: 'srv_1', name: 'Test Server' }
          },
          serverSession: { id: 'ss_1' }
        }
      };

      db.sessionEvent.findFirst.mockResolvedValue(mockEvent);

      const result = await sessionEventService.getSessionEventById({
        session: mockSession as any,
        sessionEventId: 'evt_123'
      });

      expect(result).toEqual(mockEvent);
      expect(db.sessionEvent.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'evt_123',
          sessionOid: mockSession.oid
        },
        include: expect.any(Object)
      });
    });

    it('should throw ServiceError when event not found', async () => {
      db.sessionEvent.findFirst.mockResolvedValue(null);

      await expect(
        sessionEventService.getSessionEventById({
          session: mockSession as any,
          sessionEventId: 'evt_nonexistent'
        })
      ).rejects.toThrow();
    });

    it('should include proper relations in query', async () => {
      const mockEvent = {
        oid: 1,
        id: 'evt_123',
        serverRun: {
          include: {
            serverVersion: true,
            serverDeployment: {
              include: {
                server: true
              }
            },
            serverSession: true
          }
        },
        serverRunError: {
          include: {
            serverRun: true
          }
        }
      };

      db.sessionEvent.findFirst.mockResolvedValue(mockEvent);

      await sessionEventService.getSessionEventById({
        session: mockSession as any,
        sessionEventId: 'evt_123'
      });

      expect(db.sessionEvent.findFirst).toHaveBeenCalledWith({
        where: expect.any(Object),
        include: expect.objectContaining({
          serverRun: expect.any(Object),
          serverRunError: expect.any(Object)
        })
      });
    });
  });

  describe('listSessionEvents', () => {
    const mockSession = {
      oid: 1,
      id: 'ses_123',
      instanceOid: 10
    };

    it('should return paginator for all session events without filters', async () => {
      db.sessionEvent.findMany.mockResolvedValue([]);

      const result = await sessionEventService.listSessionEvents({
        session: mockSession as any
      });

      expect(result).toBeDefined();
      expect(result.__isPaginator).toBe(true);
    });

    it('should filter by serverRunIds when provided', async () => {
      const mockServerRuns = [{ oid: 20, id: 'run_1' }];
      db.serverRun.findMany.mockResolvedValue(mockServerRuns);
      db.sessionEvent.findMany.mockResolvedValue([]);

      await sessionEventService.listSessionEvents({
        session: mockSession as any,
        serverRunIds: ['run_1']
      });

      expect(db.serverRun.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['run_1'] }, instanceOid: mockSession.instanceOid }
      });
    });

    it('should filter by serverSessionIds when provided', async () => {
      const mockServerSessions = [{ oid: 30, id: 'ss_1' }];
      db.serverSession.findMany.mockResolvedValue(mockServerSessions);
      db.sessionEvent.findMany.mockResolvedValue([]);

      await sessionEventService.listSessionEvents({
        session: mockSession as any,
        serverSessionIds: ['ss_1']
      });

      expect(db.serverSession.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['ss_1'] }, instanceOid: mockSession.instanceOid }
      });
    });

    it('should handle multiple filters simultaneously', async () => {
      const mockServerRuns = [{ oid: 20, id: 'run_1' }];
      const mockServerSessions = [{ oid: 30, id: 'ss_1' }];

      db.serverRun.findMany.mockResolvedValue(mockServerRuns);
      db.serverSession.findMany.mockResolvedValue(mockServerSessions);
      db.sessionEvent.findMany.mockResolvedValue([]);

      await sessionEventService.listSessionEvents({
        session: mockSession as any,
        serverRunIds: ['run_1'],
        serverSessionIds: ['ss_1']
      });

      expect(db.serverRun.findMany).toHaveBeenCalled();
      expect(db.serverSession.findMany).toHaveBeenCalled();
    });

    it('should not query related entities when no IDs provided', async () => {
      db.sessionEvent.findMany.mockResolvedValue([]);

      await sessionEventService.listSessionEvents({
        session: mockSession as any
      });

      expect(db.serverRun.findMany).not.toHaveBeenCalled();
      expect(db.serverSession.findMany).not.toHaveBeenCalled();
    });

    it('should handle empty arrays for filter IDs', async () => {
      db.sessionEvent.findMany.mockResolvedValue([]);

      await sessionEventService.listSessionEvents({
        session: mockSession as any,
        serverRunIds: [],
        serverSessionIds: []
      });

      expect(db.serverRun.findMany).not.toHaveBeenCalled();
      expect(db.serverSession.findMany).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    const mockSession = {
      oid: 1,
      id: 'ses_123',
      instanceOid: 10
    };

    it('should handle very long event IDs', async () => {
      const longId = 'evt_' + 'a'.repeat(1000);
      db.sessionEvent.findFirst.mockResolvedValue(null);

      await expect(
        sessionEventService.getSessionEventById({
          session: mockSession as any,
          sessionEventId: longId
        })
      ).rejects.toThrow();

      expect(db.sessionEvent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: longId
          })
        })
      );
    });

    it('should handle special characters in IDs', async () => {
      const specialId = 'evt_<script>alert("xss")</script>';
      db.sessionEvent.findFirst.mockResolvedValue(null);

      await expect(
        sessionEventService.getSessionEventById({
          session: mockSession as any,
          sessionEventId: specialId
        })
      ).rejects.toThrow();
    });

    it('should handle events with null serverRun', async () => {
      const mockEvent = {
        oid: 1,
        id: 'evt_123',
        sessionOid: 1,
        type: 'custom_event',
        serverRun: null,
        serverRunError: null
      };

      db.sessionEvent.findFirst.mockResolvedValue(mockEvent);

      const result = await sessionEventService.getSessionEventById({
        session: mockSession as any,
        sessionEventId: 'evt_123'
      });

      expect(result).toEqual(mockEvent);
      expect(result.serverRun).toBeNull();
    });

    it('should handle large number of filter IDs', async () => {
      const manyRunIds = Array.from({ length: 1000 }, (_, i) => `run_${i}`);
      const mockServerRuns = manyRunIds.map((id, i) => ({ oid: i, id }));

      db.serverRun.findMany.mockResolvedValue(mockServerRuns);
      db.sessionEvent.findMany.mockResolvedValue([]);

      await sessionEventService.listSessionEvents({
        session: mockSession as any,
        serverRunIds: manyRunIds
      });

      expect(db.serverRun.findMany).toHaveBeenCalledWith({
        where: { id: { in: manyRunIds }, instanceOid: mockSession.instanceOid }
      });
    });
  });
});
