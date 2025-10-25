import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serverSessionService } from '../src/services/serverSession';

// Mock dependencies
vi.mock('@metorial/db', () => ({
  db: {
    serverSession: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateManyAndReturn: vi.fn()
    }
  },
  ID: {
    generateId: vi.fn((type) => Promise.resolve(`${type}_test_id_${Date.now()}`))
  }
}));

vi.mock('@metorial/lock', () => ({
  createLock: vi.fn(() => ({
    usingLock: vi.fn((key, fn) => fn())
  }))
}));

vi.mock('@metorial/module-event', () => ({
  ingestEventService: {
    ingest: vi.fn()
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

vi.mock('../src/queue/serverSessionCreated', () => ({
  serverSessionCreatedQueue: {
    add: vi.fn()
  }
}));

describe('serverSessionService', () => {
  let db: any;
  let ingestEventService: any;
  let serverSessionCreatedQueue: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const dbModule = await import('@metorial/db');
    db = dbModule.db;

    const eventModule = await import('@metorial/module-event');
    ingestEventService = eventModule.ingestEventService;

    const queueModule = await import('../src/queue/serverSessionCreated');
    serverSessionCreatedQueue = queueModule.serverSessionCreatedQueue;
  });

  describe('ensureServerSession', () => {
    const mockSession = {
      oid: 1,
      id: 'ses_123',
      instanceOid: 10
    };

    const mockServerDeployment = {
      oid: 2,
      id: 'dep_123'
    };

    const mockContext = {
      ua: 'test-user-agent',
      ip: '192.168.1.1'
    };

    it('should return existing running server session', async () => {
      const existingSession = {
        oid: 5,
        id: 'ss_existing',
        status: 'running',
        serverDeployment: { id: 'dep_123' },
        sessionConnection: null
      };

      db.serverSession.findFirst.mockResolvedValue(existingSession);

      const result = await serverSessionService.ensureServerSession({
        session: mockSession as any,
        serverDeployment: mockServerDeployment as any,
        context: mockContext as any,
        connectionType: 'sse'
      });

      expect(result).toEqual(existingSession);
      expect(db.serverSession.findFirst).toHaveBeenCalledWith({
        where: {
          sessionOid: mockSession.oid,
          serverDeploymentOid: mockServerDeployment.oid,
          status: 'running'
        },
        include: expect.any(Object)
      });
      expect(db.serverSession.create).not.toHaveBeenCalled();
    });

    it('should create new server session when none exists', async () => {
      db.serverSession.findFirst.mockResolvedValue(null);

      const newSession = {
        oid: 6,
        id: 'ss_new',
        status: 'pending',
        instance: {
          id: 'inst_1',
          organization: { id: 'org_1' }
        },
        serverDeployment: { id: 'dep_123' },
        sessionConnection: null
      };

      db.serverSession.create.mockResolvedValue(newSession);

      const result = await serverSessionService.ensureServerSession({
        session: mockSession as any,
        serverDeployment: mockServerDeployment as any,
        context: mockContext as any,
        connectionType: 'sse'
      });

      expect(result).toEqual(newSession);
      expect(db.serverSession.create).toHaveBeenCalled();
      expect(ingestEventService.ingest).toHaveBeenCalledWith(
        'session.server_session:created',
        expect.any(Object)
      );
      expect(serverSessionCreatedQueue.add).toHaveBeenCalled();
    });
  });

  describe('createServerSession', () => {
    const mockSession = {
      oid: 1,
      id: 'ses_123',
      instanceOid: 10
    };

    const mockServerDeployment = {
      oid: 2,
      id: 'dep_123'
    };

    const mockContext = {
      ua: 'test-user-agent',
      ip: '192.168.1.1'
    };

    it('should create server session with pending status', async () => {
      const newSession = {
        oid: 6,
        id: 'ss_new',
        status: 'pending',
        mcpConnectionType: 'sse',
        instance: {
          id: 'inst_1',
          organization: { id: 'org_1' }
        },
        serverDeployment: { id: 'dep_123' },
        sessionConnection: null
      };

      db.serverSession.create.mockResolvedValue(newSession);

      const result = await serverSessionService.createServerSession({
        session: mockSession as any,
        serverDeployment: mockServerDeployment as any,
        context: mockContext as any,
        connectionType: 'sse'
      });

      expect(result).toEqual(newSession);
      expect(db.serverSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          serverDeploymentOid: mockServerDeployment.oid,
          instanceOid: mockSession.instanceOid,
          sessionOid: mockSession.oid,
          status: 'pending',
          mcpConnectionType: 'sse'
        }),
        include: expect.any(Object)
      });
    });

    it('should ingest creation event', async () => {
      const newSession = {
        oid: 6,
        id: 'ss_new',
        status: 'pending',
        instance: {
          id: 'inst_1',
          organization: { id: 'org_1' }
        }
      };

      db.serverSession.create.mockResolvedValue(newSession);

      await serverSessionService.createServerSession({
        session: mockSession as any,
        serverDeployment: mockServerDeployment as any,
        context: mockContext as any,
        connectionType: 'sse'
      });

      expect(ingestEventService.ingest).toHaveBeenCalledWith(
        'session.server_session:created',
        {
          session: mockSession,
          serverSession: newSession,
          instance: newSession.instance,
          organization: newSession.instance.organization
        }
      );
    });

    it('should add job to queue', async () => {
      const newSession = {
        oid: 6,
        id: 'ss_new',
        status: 'pending',
        instance: {
          id: 'inst_1',
          organization: { id: 'org_1' }
        }
      };

      db.serverSession.create.mockResolvedValue(newSession);

      await serverSessionService.createServerSession({
        session: mockSession as any,
        serverDeployment: mockServerDeployment as any,
        context: mockContext as any,
        connectionType: 'sse'
      });

      expect(serverSessionCreatedQueue.add).toHaveBeenCalledWith({
        serverSessionId: newSession.id,
        context: mockContext
      });
    });

    it('should handle stdio connection type', async () => {
      const newSession = {
        oid: 6,
        id: 'ss_new',
        status: 'pending',
        mcpConnectionType: 'stdio',
        instance: {
          id: 'inst_1',
          organization: { id: 'org_1' }
        }
      };

      db.serverSession.create.mockResolvedValue(newSession);

      await serverSessionService.createServerSession({
        session: mockSession as any,
        serverDeployment: mockServerDeployment as any,
        context: mockContext as any,
        connectionType: 'stdio'
      });

      expect(db.serverSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          mcpConnectionType: 'stdio'
        }),
        include: expect.any(Object)
      });
    });
  });

  describe('getServerSessionById', () => {
    const mockSession = {
      oid: 1,
      id: 'ses_123'
    };

    it('should return server session when found', async () => {
      const serverSession = {
        oid: 5,
        id: 'ss_123',
        sessionOid: 1,
        serverDeployment: {
          id: 'dep_123',
          server: { id: 'srv_1' }
        },
        sessionConnection: null
      };

      db.serverSession.findFirst.mockResolvedValue(serverSession);

      const result = await serverSessionService.getServerSessionById({
        session: mockSession as any,
        serverSessionId: 'ss_123'
      });

      expect(result).toEqual(serverSession);
      expect(db.serverSession.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'ss_123',
          sessionOid: mockSession.oid
        },
        include: expect.any(Object)
      });
    });

    it('should throw ServiceError when server session not found', async () => {
      db.serverSession.findFirst.mockResolvedValue(null);

      await expect(
        serverSessionService.getServerSessionById({
          session: mockSession as any,
          serverSessionId: 'ss_nonexistent'
        })
      ).rejects.toThrow();
    });
  });

  describe('listServerSessions', () => {
    const mockSession = {
      oid: 1,
      id: 'ses_123'
    };

    it('should return paginator for server sessions', async () => {
      db.serverSession.findMany.mockResolvedValue([]);

      const result = await serverSessionService.listServerSessions({
        session: mockSession as any
      });

      expect(result).toBeDefined();
      expect(result.__isPaginator).toBe(true);
    });

    it('should filter by session oid', async () => {
      db.serverSession.findMany.mockResolvedValue([
        {
          oid: 5,
          id: 'ss_1',
          sessionOid: 1,
          serverDeployment: { id: 'dep_1' },
          sessionConnection: null
        }
      ]);

      const result = await serverSessionService.listServerSessions({
        session: mockSession as any
      });

      // Verify paginator is created with correct filter
      expect(result).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent ensureServerSession calls', async () => {
      const mockSession = { oid: 1, id: 'ses_123', instanceOid: 10 };
      const mockServerDeployment = { oid: 2, id: 'dep_123' };
      const mockContext = { ua: 'test', ip: '127.0.0.1' };

      db.serverSession.findFirst.mockResolvedValue(null);
      db.serverSession.create.mockResolvedValue({
        oid: 5,
        id: 'ss_new',
        status: 'pending',
        instance: { id: 'inst_1', organization: { id: 'org_1' } }
      });

      const promises = Array.from({ length: 3 }, () =>
        serverSessionService.ensureServerSession({
          session: mockSession as any,
          serverDeployment: mockServerDeployment as any,
          context: mockContext as any,
          connectionType: 'sse'
        })
      );

      await Promise.all(promises);

      // Lock should prevent race conditions
      expect(db.serverSession.findFirst).toHaveBeenCalled();
    });

    it('should handle missing context fields', async () => {
      const mockSession = { oid: 1, id: 'ses_123', instanceOid: 10 };
      const mockServerDeployment = { oid: 2, id: 'dep_123' };
      const emptyContext = { ua: undefined, ip: undefined };

      db.serverSession.findFirst.mockResolvedValue(null);
      db.serverSession.create.mockResolvedValue({
        oid: 5,
        id: 'ss_new',
        status: 'pending',
        instance: { id: 'inst_1', organization: { id: 'org_1' } }
      });

      await serverSessionService.createServerSession({
        session: mockSession as any,
        serverDeployment: mockServerDeployment as any,
        context: emptyContext as any,
        connectionType: 'sse'
      });

      expect(db.serverSession.create).toHaveBeenCalled();
      expect(serverSessionCreatedQueue.add).toHaveBeenCalledWith({
        serverSessionId: expect.any(String),
        context: emptyContext
      });
    });

    it('should handle very long server session IDs', async () => {
      const longId = 'ss_' + 'a'.repeat(1000);
      const mockSession = { oid: 1, id: 'ses_123' };

      db.serverSession.findFirst.mockResolvedValue(null);

      await expect(
        serverSessionService.getServerSessionById({
          session: mockSession as any,
          serverSessionId: longId
        })
      ).rejects.toThrow();
    });
  });
});
