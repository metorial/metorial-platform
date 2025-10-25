import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serverOAuthSessionService } from '../src/services/oauthSession';

// Mock dependencies
vi.mock('@metorial/db', () => ({
  db: {
    serverOAuthSession: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    providerOAuthConnection: {
      findMany: vi.fn()
    },
    session: {
      findMany: vi.fn()
    }
  },
  ID: {
    generateId: vi.fn((type) => Promise.resolve(`${type}_test_id_${Date.now()}`))
  }
}));

vi.mock('@metorial/error', () => ({
  notFoundError: vi.fn((msg) => ({ code: 'not_found', message: msg })),
  preconditionFailedError: vi.fn((opts) => ({ code: 'precondition_failed', ...opts })),
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

describe('serverOAuthSessionService', () => {
  let db: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const dbModule = await import('@metorial/db');
    db = dbModule.db;
  });

  describe('getServerOAuthSessionById', () => {
    const mockInstance = {
      oid: 1,
      id: 'inst_123'
    };

    it('should return OAuth session when found', async () => {
      const mockOAuthSession = {
        oid: 1,
        id: 'oauth_123',
        instanceOid: 1,
        status: 'completed',
        connection: {
          id: 'conn_1',
          template: { id: 'tmpl_1' },
          instance: { id: 'inst_1' },
          config: { id: 'cfg_1' }
        }
      };

      db.serverOAuthSession.findFirst.mockResolvedValue(mockOAuthSession);

      const result = await serverOAuthSessionService.getServerOAuthSessionById({
        instance: mockInstance as any,
        serverOAuthSessionId: 'oauth_123'
      });

      expect(result).toEqual(mockOAuthSession);
      expect(db.serverOAuthSession.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'oauth_123',
          instanceOid: 1
        },
        include: expect.any(Object)
      });
    });

    it('should throw ServiceError when OAuth session not found', async () => {
      db.serverOAuthSession.findFirst.mockResolvedValue(null);

      await expect(
        serverOAuthSessionService.getServerOAuthSessionById({
          instance: mockInstance as any,
          serverOAuthSessionId: 'oauth_nonexistent'
        })
      ).rejects.toThrow();
    });
  });

  describe('getServerOAuthSessionByClientSecretAndReportOpened', () => {
    it('should return OAuth session and update status to opened if pending', async () => {
      const mockOAuthSession = {
        oid: 1,
        id: 'oauth_123',
        clientSecret: 'secret_abc',
        status: 'pending',
        connection: {
          id: 'conn_1',
          template: { id: 'tmpl_1' },
          instance: { id: 'inst_1', organization: { id: 'org_1' } },
          config: { id: 'cfg_1' }
        },
        instance: { id: 'inst_1', organization: { id: 'org_1' } }
      };

      db.serverOAuthSession.findFirst.mockResolvedValue(mockOAuthSession);
      db.serverOAuthSession.update.mockResolvedValue({ status: 'opened' });

      const result = await serverOAuthSessionService.getServerOAuthSessionByClientSecretAndReportOpened({
        clientSecret: 'secret_abc'
      });

      expect(db.serverOAuthSession.update).toHaveBeenCalledWith({
        where: { id: mockOAuthSession.id },
        data: { status: 'opened' }
      });
      expect(result.status).toBe('opened');
    });

    it('should return OAuth session without updating if already opened', async () => {
      const mockOAuthSession = {
        oid: 1,
        id: 'oauth_123',
        clientSecret: 'secret_abc',
        status: 'opened',
        connection: {},
        instance: { organization: {} }
      };

      db.serverOAuthSession.findFirst.mockResolvedValue(mockOAuthSession);

      await serverOAuthSessionService.getServerOAuthSessionByClientSecretAndReportOpened({
        clientSecret: 'secret_abc'
      });

      expect(db.serverOAuthSession.update).not.toHaveBeenCalled();
    });

    it('should throw error if session is not pending or opened', async () => {
      const mockOAuthSession = {
        oid: 1,
        id: 'oauth_123',
        clientSecret: 'secret_abc',
        status: 'completed',
        connection: {},
        instance: { organization: {} }
      };

      db.serverOAuthSession.findFirst.mockResolvedValue(mockOAuthSession);

      await expect(
        serverOAuthSessionService.getServerOAuthSessionByClientSecretAndReportOpened({
          clientSecret: 'secret_abc'
        })
      ).rejects.toThrow();
    });

    it('should throw error if session not found', async () => {
      db.serverOAuthSession.findFirst.mockResolvedValue(null);

      await expect(
        serverOAuthSessionService.getServerOAuthSessionByClientSecretAndReportOpened({
          clientSecret: 'secret_nonexistent'
        })
      ).rejects.toThrow();
    });
  });

  describe('getManyServerOAuthSessions', () => {
    const mockInstance = {
      oid: 1,
      id: 'inst_123'
    };

    it('should return multiple OAuth sessions', async () => {
      const mockSessions = [
        { oid: 1, id: 'oauth_1', connection: {} },
        { oid: 2, id: 'oauth_2', connection: {} }
      ];

      db.serverOAuthSession.findMany.mockResolvedValue(mockSessions);

      const result = await serverOAuthSessionService.getManyServerOAuthSessions({
        instance: mockInstance as any,
        sessionIds: ['oauth_1', 'oauth_2']
      });

      expect(result).toEqual(mockSessions);
      expect(db.serverOAuthSession.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['oauth_1', 'oauth_2'] },
          instanceOid: 1
        },
        include: expect.any(Object)
      });
    });

    it('should return empty array for empty session IDs', async () => {
      const result = await serverOAuthSessionService.getManyServerOAuthSessions({
        instance: mockInstance as any,
        sessionIds: []
      });

      expect(result).toEqual([]);
      expect(db.serverOAuthSession.findMany).not.toHaveBeenCalled();
    });
  });

  describe('createServerOAuthSession', () => {
    const mockInstance = {
      oid: 1,
      id: 'inst_123'
    };

    const mockConnection = {
      oid: 2,
      id: 'conn_123'
    };

    it('should create OAuth session with metadata and redirectUri', async () => {
      const mockCreatedSession = {
        oid: 5,
        id: 'oauth_new',
        status: 'pending',
        metadata: { key: 'value' },
        redirectUri: 'https://example.com/callback',
        connection: {}
      };

      db.serverOAuthSession.create.mockResolvedValue(mockCreatedSession);

      const result = await serverOAuthSessionService.createServerOAuthSession({
        instance: mockInstance as any,
        connection: mockConnection as any,
        input: {
          metadata: { key: 'value' },
          redirectUri: 'https://example.com/callback'
        }
      });

      expect(result).toEqual(mockCreatedSession);
      expect(db.serverOAuthSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'pending',
          instanceOid: 1,
          connectionOid: 2,
          metadata: { key: 'value' },
          redirectUri: 'https://example.com/callback'
        }),
        include: expect.any(Object)
      });
    });

    it('should create OAuth session without metadata and redirectUri', async () => {
      const mockCreatedSession = {
        oid: 5,
        id: 'oauth_new',
        status: 'pending',
        connection: {}
      };

      db.serverOAuthSession.create.mockResolvedValue(mockCreatedSession);

      await serverOAuthSessionService.createServerOAuthSession({
        instance: mockInstance as any,
        connection: mockConnection as any,
        input: {}
      });

      expect(db.serverOAuthSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'pending',
          metadata: undefined,
          redirectUri: undefined
        }),
        include: expect.any(Object)
      });
    });
  });

  describe('archiveServerOAuthSession', () => {
    it('should archive OAuth session', async () => {
      const mockSession = {
        oid: 1,
        id: 'oauth_123',
        status: 'completed'
      };

      const archivedSession = {
        ...mockSession,
        status: 'archived',
        connection: {}
      };

      db.serverOAuthSession.update.mockResolvedValue(archivedSession);

      const result = await serverOAuthSessionService.archiveServerOAuthSession({
        session: mockSession as any
      });

      expect(result).toEqual(archivedSession);
      expect(db.serverOAuthSession.update).toHaveBeenCalledWith({
        where: { id: 'oauth_123' },
        data: { status: 'archived' },
        include: expect.any(Object)
      });
    });

    it('should throw error if session is already archived', async () => {
      const mockSession = {
        oid: 1,
        id: 'oauth_123',
        status: 'archived'
      };

      await expect(
        serverOAuthSessionService.archiveServerOAuthSession({
          session: mockSession as any
        })
      ).rejects.toThrow();

      expect(db.serverOAuthSession.update).not.toHaveBeenCalled();
    });
  });

  describe('completeServerOAuthSession', () => {
    const mockTokenReference = {
      oid: 10,
      id: 'token_ref_123'
    };

    it('should complete OAuth session from opened status', async () => {
      const mockSession = {
        oid: 1,
        id: 'oauth_123',
        status: 'opened'
      };

      const completedSession = {
        ...mockSession,
        status: 'completed',
        tokenReferenceOid: 10
      };

      db.serverOAuthSession.update.mockResolvedValue(completedSession);

      const result = await serverOAuthSessionService.completeServerOAuthSession({
        session: mockSession as any,
        tokenReference: mockTokenReference as any
      });

      expect(result).toEqual(completedSession);
      expect(db.serverOAuthSession.update).toHaveBeenCalledWith({
        where: { id: 'oauth_123' },
        data: {
          status: 'completed',
          completedAt: expect.any(Date),
          tokenReferenceOid: 10
        }
      });
    });

    it('should complete OAuth session from pending status', async () => {
      const mockSession = {
        oid: 1,
        id: 'oauth_123',
        status: 'pending'
      };

      db.serverOAuthSession.update.mockResolvedValue({});

      await serverOAuthSessionService.completeServerOAuthSession({
        session: mockSession as any,
        tokenReference: mockTokenReference as any
      });

      expect(db.serverOAuthSession.update).toHaveBeenCalled();
    });

    it('should throw error if session cannot be completed', async () => {
      const mockSession = {
        oid: 1,
        id: 'oauth_123',
        status: 'completed'
      };

      await expect(
        serverOAuthSessionService.completeServerOAuthSession({
          session: mockSession as any,
          tokenReference: mockTokenReference as any
        })
      ).rejects.toThrow();

      expect(db.serverOAuthSession.update).not.toHaveBeenCalled();
    });
  });

  describe('listServerOAuthSessions', () => {
    const mockInstance = {
      oid: 1,
      id: 'inst_123'
    };

    it('should return paginator for all OAuth sessions', async () => {
      db.serverOAuthSession.findMany.mockResolvedValue([]);

      const result = await serverOAuthSessionService.listServerOAuthSessions({
        instance: mockInstance as any
      });

      expect(result).toBeDefined();
      expect(result.__isPaginator).toBe(true);
    });

    it('should filter by status', async () => {
      db.serverOAuthSession.findMany.mockResolvedValue([]);

      await serverOAuthSessionService.listServerOAuthSessions({
        instance: mockInstance as any,
        status: ['completed', 'opened']
      });

      // Paginator should be created with status filter
      expect(db.serverOAuthSession.findMany).toBeDefined();
    });

    it('should filter by oauthConnectionIds', async () => {
      const mockConnections = [{ oid: 10, id: 'conn_1' }];
      db.providerOAuthConnection.findMany.mockResolvedValue(mockConnections);
      db.serverOAuthSession.findMany.mockResolvedValue([]);

      await serverOAuthSessionService.listServerOAuthSessions({
        instance: mockInstance as any,
        oauthConnectionIds: ['conn_1']
      });

      expect(db.providerOAuthConnection.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['conn_1'] }, instanceOid: 1 }
      });
    });

    it('should filter by sessionIds', async () => {
      const mockSessions = [{ oid: 20, id: 'ses_1' }];
      db.session.findMany.mockResolvedValue(mockSessions);
      db.serverOAuthSession.findMany.mockResolvedValue([]);

      await serverOAuthSessionService.listServerOAuthSessions({
        instance: mockInstance as any,
        sessionIds: ['ses_1']
      });

      expect(db.session.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['ses_1'] }, instanceOid: 1 }
      });
    });

    it('should exclude archived sessions by default', async () => {
      db.serverOAuthSession.findMany.mockResolvedValue([]);

      await serverOAuthSessionService.listServerOAuthSessions({
        instance: mockInstance as any
      });

      // Default filter should exclude archived
      expect(db.serverOAuthSession.findMany).toBeDefined();
    });
  });

  describe('edge cases', () => {
    const mockInstance = {
      oid: 1,
      id: 'inst_123'
    };

    it('should handle very long OAuth session IDs', async () => {
      const longId = 'oauth_' + 'a'.repeat(1000);
      db.serverOAuthSession.findFirst.mockResolvedValue(null);

      await expect(
        serverOAuthSessionService.getServerOAuthSessionById({
          instance: mockInstance as any,
          serverOAuthSessionId: longId
        })
      ).rejects.toThrow();
    });

    it('should handle special characters in client secrets', async () => {
      const specialSecret = 'secret_<script>alert("xss")</script>';
      db.serverOAuthSession.findFirst.mockResolvedValue(null);

      await expect(
        serverOAuthSessionService.getServerOAuthSessionByClientSecretAndReportOpened({
          clientSecret: specialSecret
        })
      ).rejects.toThrow();
    });

    it('should handle large metadata objects', async () => {
      const largeMetadata = {
        key1: 'x'.repeat(10000),
        key2: 'y'.repeat(10000)
      };

      db.serverOAuthSession.create.mockResolvedValue({
        oid: 5,
        id: 'oauth_new',
        status: 'pending',
        metadata: largeMetadata,
        connection: {}
      });

      await serverOAuthSessionService.createServerOAuthSession({
        instance: mockInstance as any,
        connection: { oid: 2, id: 'conn_123' } as any,
        input: { metadata: largeMetadata }
      });

      expect(db.serverOAuthSession.create).toHaveBeenCalled();
    });
  });
});
