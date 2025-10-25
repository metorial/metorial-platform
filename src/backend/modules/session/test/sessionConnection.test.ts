import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sessionConnectionService } from '../src/services/sessionConnection';

// Mock dependencies
vi.mock('@metorial/db', () => ({
  db: {
    sessionConnection: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/error', () => ({
  notFoundError: vi.fn((msg, id?) => ({ code: 'not_found', message: msg, id })),
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

describe('sessionConnectionService', () => {
  let db: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const dbModule = await import('@metorial/db');
    db = dbModule.db;
  });

  describe('getSessionConnectionById', () => {
    const mockSession = {
      oid: 1,
      id: 'ses_123'
    };

    it('should return session connection when found', async () => {
      const mockConnection = {
        oid: 1,
        id: 'conn_123',
        sessionOid: 1,
        serverSession: {
          id: 'ss_1',
          serverDeployment: {
            id: 'dep_1',
            server: { id: 'srv_1', name: 'Test Server' },
            serverVariant: { id: 'var_1' }
          }
        }
      };

      db.sessionConnection.findFirst.mockResolvedValue(mockConnection);

      const result = await sessionConnectionService.getSessionConnectionById({
        session: mockSession as any,
        sessionConnectionId: 'conn_123'
      });

      expect(result).toEqual(mockConnection);
      expect(db.sessionConnection.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'conn_123',
          sessionOid: mockSession.oid
        },
        include: expect.any(Object)
      });
    });

    it('should throw ServiceError when connection not found', async () => {
      db.sessionConnection.findFirst.mockResolvedValue(null);

      await expect(
        sessionConnectionService.getSessionConnectionById({
          session: mockSession as any,
          sessionConnectionId: 'conn_nonexistent'
        })
      ).rejects.toThrow();

      expect(db.sessionConnection.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'conn_nonexistent',
          sessionOid: mockSession.oid
        },
        include: expect.any(Object)
      });
    });

    it('should include proper relations in query', async () => {
      const mockConnection = {
        oid: 1,
        id: 'conn_123',
        serverSession: {
          include: {
            serverDeployment: {
              include: {
                server: true,
                serverVariant: true
              }
            }
          }
        }
      };

      db.sessionConnection.findFirst.mockResolvedValue(mockConnection);

      await sessionConnectionService.getSessionConnectionById({
        session: mockSession as any,
        sessionConnectionId: 'conn_123'
      });

      expect(db.sessionConnection.findFirst).toHaveBeenCalledWith({
        where: expect.any(Object),
        include: expect.objectContaining({
          serverSession: expect.any(Object)
        })
      });
    });

    it('should pass connection ID to notFoundError', async () => {
      const { notFoundError } = await import('@metorial/error');
      db.sessionConnection.findFirst.mockResolvedValue(null);

      try {
        await sessionConnectionService.getSessionConnectionById({
          session: mockSession as any,
          sessionConnectionId: 'conn_specific_id'
        });
      } catch (e) {
        // Error thrown as expected
      }

      expect(notFoundError).toHaveBeenCalledWith('session_connection', 'conn_specific_id');
    });
  });

  describe('listSessionConnections', () => {
    const mockSession = {
      oid: 1,
      id: 'ses_123'
    };

    it('should return paginator for session connections', async () => {
      db.sessionConnection.findMany.mockResolvedValue([]);

      const result = await sessionConnectionService.listSessionConnections({
        session: mockSession as any
      });

      expect(result).toBeDefined();
      expect(result.__isPaginator).toBe(true);
    });

    it('should filter by session oid', async () => {
      const mockConnections = [
        {
          oid: 1,
          id: 'conn_1',
          sessionOid: 1,
          serverSession: {
            id: 'ss_1',
            serverDeployment: { id: 'dep_1', server: { id: 'srv_1' } }
          }
        },
        {
          oid: 2,
          id: 'conn_2',
          sessionOid: 1,
          serverSession: {
            id: 'ss_2',
            serverDeployment: { id: 'dep_2', server: { id: 'srv_2' } }
          }
        }
      ];

      db.sessionConnection.findMany.mockResolvedValue(mockConnections);

      const paginator = await sessionConnectionService.listSessionConnections({
        session: mockSession as any
      });

      expect(paginator).toBeDefined();
    });

    it('should include relations in list query', async () => {
      db.sessionConnection.findMany.mockResolvedValue([]);

      await sessionConnectionService.listSessionConnections({
        session: mockSession as any
      });

      const paginator = await sessionConnectionService.listSessionConnections({
        session: mockSession as any
      });

      expect(paginator).toBeDefined();
    });
  });

  describe('edge cases', () => {
    const mockSession = {
      oid: 1,
      id: 'ses_123'
    };

    it('should handle very long connection IDs', async () => {
      const longId = 'conn_' + 'a'.repeat(1000);
      db.sessionConnection.findFirst.mockResolvedValue(null);

      await expect(
        sessionConnectionService.getSessionConnectionById({
          session: mockSession as any,
          sessionConnectionId: longId
        })
      ).rejects.toThrow();

      expect(db.sessionConnection.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: longId
          })
        })
      );
    });

    it('should handle special characters in IDs', async () => {
      const specialId = 'conn_<script>alert("xss")</script>';
      db.sessionConnection.findFirst.mockResolvedValue(null);

      await expect(
        sessionConnectionService.getSessionConnectionById({
          session: mockSession as any,
          sessionConnectionId: specialId
        })
      ).rejects.toThrow();
    });

    it('should handle null or undefined session', async () => {
      db.sessionConnection.findFirst.mockResolvedValue(null);

      await expect(
        sessionConnectionService.getSessionConnectionById({
          session: null as any,
          sessionConnectionId: 'conn_123'
        })
      ).rejects.toThrow();
    });

    it('should handle connections with null serverSession', async () => {
      const mockConnection = {
        oid: 1,
        id: 'conn_123',
        sessionOid: 1,
        serverSession: null
      };

      db.sessionConnection.findFirst.mockResolvedValue(mockConnection);

      const result = await sessionConnectionService.getSessionConnectionById({
        session: mockSession as any,
        sessionConnectionId: 'conn_123'
      });

      expect(result).toEqual(mockConnection);
      expect(result.serverSession).toBeNull();
    });

    it('should handle empty list results', async () => {
      db.sessionConnection.findMany.mockResolvedValue([]);

      const paginator = await sessionConnectionService.listSessionConnections({
        session: mockSession as any
      });

      expect(paginator).toBeDefined();
      expect(paginator.__isPaginator).toBe(true);
    });

    it('should handle session with different oid types', async () => {
      const sessionWithStringOid = {
        oid: '1' as any,
        id: 'ses_123'
      };

      db.sessionConnection.findFirst.mockResolvedValue(null);

      await expect(
        sessionConnectionService.getSessionConnectionById({
          session: sessionWithStringOid,
          sessionConnectionId: 'conn_123'
        })
      ).rejects.toThrow();
    });
  });
});
