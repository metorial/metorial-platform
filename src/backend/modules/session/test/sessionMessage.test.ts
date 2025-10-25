import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sessionMessageService } from '../src/services/sessionMessage';

// Mock dependencies
vi.mock('@metorial/db', () => ({
  db: {
    sessionMessage: {
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

describe('sessionMessageService', () => {
  let db: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const dbModule = await import('@metorial/db');
    db = dbModule.db;
  });

  describe('getSessionMessageById', () => {
    const mockSession = {
      oid: 1,
      id: 'ses_123'
    };

    it('should return session message when found', async () => {
      const mockMessage = {
        oid: 1,
        id: 'msg_123',
        sessionOid: 1,
        type: 'client_request',
        content: { method: 'test' },
        serverSession: { id: 'ss_1' }
      };

      db.sessionMessage.findFirst.mockResolvedValue(mockMessage);

      const result = await sessionMessageService.getSessionMessageById({
        session: mockSession as any,
        sessionMessageId: 'msg_123'
      });

      expect(result).toEqual(mockMessage);
      expect(db.sessionMessage.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'msg_123',
          sessionOid: mockSession.oid
        },
        include: expect.any(Object)
      });
    });

    it('should throw ServiceError when message not found', async () => {
      db.sessionMessage.findFirst.mockResolvedValue(null);

      await expect(
        sessionMessageService.getSessionMessageById({
          session: mockSession as any,
          sessionMessageId: 'msg_nonexistent'
        })
      ).rejects.toThrow();
    });

    it('should include serverSession relation in query', async () => {
      const mockMessage = {
        oid: 1,
        id: 'msg_123',
        serverSession: { id: 'ss_1' }
      };

      db.sessionMessage.findFirst.mockResolvedValue(mockMessage);

      await sessionMessageService.getSessionMessageById({
        session: mockSession as any,
        sessionMessageId: 'msg_123'
      });

      expect(db.sessionMessage.findFirst).toHaveBeenCalledWith({
        where: expect.any(Object),
        include: expect.objectContaining({
          serverSession: expect.any(Boolean)
        })
      });
    });
  });

  describe('listSessionMessages', () => {
    const mockSession = {
      oid: 1,
      id: 'ses_123',
      instanceOid: 10
    };

    it('should return paginator for all session messages without filters', async () => {
      db.sessionMessage.findMany.mockResolvedValue([]);

      const result = await sessionMessageService.listSessionMessages({
        session: mockSession as any
      });

      expect(result).toBeDefined();
      expect(result.__isPaginator).toBe(true);
    });

    it('should filter by serverRunIds when provided', async () => {
      const mockServerRuns = [{ oid: 20, id: 'run_1' }];
      db.serverRun.findMany.mockResolvedValue(mockServerRuns);
      db.sessionMessage.findMany.mockResolvedValue([]);

      await sessionMessageService.listSessionMessages({
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
      db.sessionMessage.findMany.mockResolvedValue([]);

      await sessionMessageService.listSessionMessages({
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
      db.sessionMessage.findMany.mockResolvedValue([]);

      await sessionMessageService.listSessionMessages({
        session: mockSession as any,
        serverRunIds: ['run_1'],
        serverSessionIds: ['ss_1']
      });

      expect(db.serverRun.findMany).toHaveBeenCalled();
      expect(db.serverSession.findMany).toHaveBeenCalled();
    });

    it('should not query related entities when no IDs provided', async () => {
      db.sessionMessage.findMany.mockResolvedValue([]);

      await sessionMessageService.listSessionMessages({
        session: mockSession as any
      });

      expect(db.serverRun.findMany).not.toHaveBeenCalled();
      expect(db.serverSession.findMany).not.toHaveBeenCalled();
    });

    it('should handle empty arrays for filter IDs', async () => {
      db.sessionMessage.findMany.mockResolvedValue([]);

      await sessionMessageService.listSessionMessages({
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

    it('should handle very long message IDs', async () => {
      const longId = 'msg_' + 'a'.repeat(1000);
      db.sessionMessage.findFirst.mockResolvedValue(null);

      await expect(
        sessionMessageService.getSessionMessageById({
          session: mockSession as any,
          sessionMessageId: longId
        })
      ).rejects.toThrow();

      expect(db.sessionMessage.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: longId
          })
        })
      );
    });

    it('should handle special characters in IDs', async () => {
      const specialId = 'msg_<script>alert("xss")</script>';
      db.sessionMessage.findFirst.mockResolvedValue(null);

      await expect(
        sessionMessageService.getSessionMessageById({
          session: mockSession as any,
          sessionMessageId: specialId
        })
      ).rejects.toThrow();
    });

    it('should handle messages with null serverSession', async () => {
      const mockMessage = {
        oid: 1,
        id: 'msg_123',
        sessionOid: 1,
        type: 'client_request',
        content: { method: 'test' },
        serverSession: null
      };

      db.sessionMessage.findFirst.mockResolvedValue(mockMessage);

      const result = await sessionMessageService.getSessionMessageById({
        session: mockSession as any,
        sessionMessageId: 'msg_123'
      });

      expect(result).toEqual(mockMessage);
      expect(result.serverSession).toBeNull();
    });

    it('should handle messages with large content', async () => {
      const largeContent = { data: 'x'.repeat(100000) };
      const mockMessage = {
        oid: 1,
        id: 'msg_123',
        sessionOid: 1,
        type: 'client_request',
        content: largeContent,
        serverSession: { id: 'ss_1' }
      };

      db.sessionMessage.findFirst.mockResolvedValue(mockMessage);

      const result = await sessionMessageService.getSessionMessageById({
        session: mockSession as any,
        sessionMessageId: 'msg_123'
      });

      expect(result.content).toEqual(largeContent);
    });

    it('should handle large number of filter IDs', async () => {
      const manyRunIds = Array.from({ length: 1000 }, (_, i) => `run_${i}`);
      const mockServerRuns = manyRunIds.map((id, i) => ({ oid: i, id }));

      db.serverRun.findMany.mockResolvedValue(mockServerRuns);
      db.sessionMessage.findMany.mockResolvedValue([]);

      await sessionMessageService.listSessionMessages({
        session: mockSession as any,
        serverRunIds: manyRunIds
      });

      expect(db.serverRun.findMany).toHaveBeenCalledWith({
        where: { id: { in: manyRunIds }, instanceOid: mockSession.instanceOid }
      });
    });

    it('should handle messages with different types', async () => {
      const messageTypes = ['client_request', 'server_response', 'server_notification'];

      for (const type of messageTypes) {
        const mockMessage = {
          oid: 1,
          id: 'msg_123',
          sessionOid: 1,
          type,
          content: {},
          serverSession: { id: 'ss_1' }
        };

        db.sessionMessage.findFirst.mockResolvedValue(mockMessage);

        const result = await sessionMessageService.getSessionMessageById({
          session: mockSession as any,
          sessionMessageId: 'msg_123'
        });

        expect(result.type).toBe(type);
      }
    });
  });
});
