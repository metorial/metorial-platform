import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userSessionService } from '../src/services/userSession';

// Mock dependencies
vi.mock('@metorial/db', () => ({
  db: {
    userSession: {
      create: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn()
    }
  },
  ID: {
    generateId: vi.fn((type) => Promise.resolve(`${type}_test_id_${Date.now()}`))
  },
  withTransaction: vi.fn((cb) => cb({
    userSession: {
      create: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn()
    }
  }))
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    fire: vi.fn()
  }
}));

vi.mock('@metorial/id', () => ({
  generateCustomId: vi.fn((prefix, length) => `${prefix}_${Math.random().toString(36).substring(2, 2 + length)}`)
}));

describe('userSessionService', () => {
  let db: any;
  let Fabric: any;
  let withTransaction: any;
  let generateCustomId: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const dbModule = await import('@metorial/db');
    db = dbModule.db;
    withTransaction = dbModule.withTransaction;

    const fabricModule = await import('@metorial/fabric');
    Fabric = fabricModule.Fabric;

    const idModule = await import('@metorial/id');
    generateCustomId = idModule.generateCustomId;
  });

  describe('createUserSession', () => {
    const mockContext = { requestId: 'test-request' } as any;
    const mockUser = {
      id: 'user_123',
      oid: 1,
      email: 'test@example.com',
      name: 'Test User'
    } as any;

    it('should create user session successfully', async () => {
      const mockSession = {
        id: 'userSession_123',
        userOid: mockUser.oid,
        clientSecret: 'metorial_ses_abc123'
      };

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          userSession: {
            create: vi.fn().mockResolvedValue(mockSession)
          }
        };
        return cb(mockDb);
      });

      const result = await userSessionService.createUserSession({
        user: mockUser,
        context: mockContext
      });

      expect(result).toEqual(mockSession);
      expect(Fabric.fire).toHaveBeenCalledWith('user.session.created:before', expect.objectContaining({
        user: mockUser,
        performedBy: mockUser
      }));
      expect(Fabric.fire).toHaveBeenCalledWith('user.session.created:after', expect.objectContaining({
        session: mockSession,
        performedBy: mockUser
      }));
    });

    it('should generate custom client secret with correct prefix', async () => {
      const mockSession = {
        id: 'userSession_123',
        userOid: mockUser.oid,
        clientSecret: 'metorial_ses_abc123'
      };

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          userSession: {
            create: vi.fn().mockResolvedValue(mockSession)
          }
        };
        return cb(mockDb);
      });

      await userSessionService.createUserSession({
        user: mockUser,
        context: mockContext
      });

      expect(generateCustomId).toHaveBeenCalledWith('metorial_ses', 50);
    });

    it('should associate session with user oid', async () => {
      const mockSession = {
        id: 'userSession_123',
        userOid: 456,
        clientSecret: 'metorial_ses_xyz789'
      };

      const userWithDifferentOid = {
        ...mockUser,
        oid: 456
      };

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          userSession: {
            create: vi.fn().mockResolvedValue(mockSession)
          }
        };
        return cb(mockDb);
      });

      const result = await userSessionService.createUserSession({
        user: userWithDifferentOid,
        context: mockContext
      });

      expect(result.userOid).toBe(456);
    });
  });

  describe('deleteUserSession', () => {
    const mockContext = { requestId: 'test-request' } as any;
    const mockUser = {
      id: 'user_123',
      oid: 1,
      email: 'test@example.com'
    } as any;
    const mockSession = {
      oid: 10,
      id: 'userSession_123',
      userOid: 1,
      clientSecret: 'metorial_ses_abc123'
    } as any;

    it('should delete user session successfully', async () => {
      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          userSession: {
            delete: vi.fn().mockResolvedValue(mockSession)
          }
        };
        return cb(mockDb);
      });

      const result = await userSessionService.deleteUserSession({
        user: mockUser,
        session: mockSession,
        context: mockContext
      });

      expect(result).toEqual(mockSession);
      expect(Fabric.fire).toHaveBeenCalledWith('user.session.deleted:before', expect.objectContaining({
        user: mockUser,
        session: mockSession,
        performedBy: mockUser
      }));
      expect(Fabric.fire).toHaveBeenCalledWith('user.session.deleted:after', expect.objectContaining({
        session: mockSession,
        performedBy: mockUser
      }));
    });

    it('should delete session by oid', async () => {
      let capturedWhere: any;

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          userSession: {
            delete: vi.fn().mockImplementation(({ where }) => {
              capturedWhere = where;
              return Promise.resolve(mockSession);
            })
          }
        };
        return cb(mockDb);
      });

      await userSessionService.deleteUserSession({
        user: mockUser,
        session: mockSession,
        context: mockContext
      });

      expect(capturedWhere).toEqual({ oid: mockSession.oid });
    });
  });

  describe('getSessionByClientSecretSafe', () => {
    const mockContext = { requestId: 'test-request' } as any;

    it('should return session with user if found', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User'
      };

      const mockSession = {
        id: 'userSession_123',
        userOid: 1,
        clientSecret: 'metorial_ses_abc123',
        user: mockUser
      };

      db.userSession.findFirst.mockResolvedValue(mockSession);

      const result = await userSessionService.getSessionByClientSecretSafe({
        clientSecret: 'metorial_ses_abc123',
        context: mockContext
      });

      expect(result).toEqual(mockSession);
      expect(db.userSession.findFirst).toHaveBeenCalledWith({
        where: {
          clientSecret: 'metorial_ses_abc123'
        },
        include: {
          user: true
        }
      });
    });

    it('should return null if session not found', async () => {
      db.userSession.findFirst.mockResolvedValue(null);

      const result = await userSessionService.getSessionByClientSecretSafe({
        clientSecret: 'metorial_ses_nonexistent',
        context: mockContext
      });

      expect(result).toBeNull();
    });

    it('should search by exact client secret match', async () => {
      db.userSession.findFirst.mockResolvedValue(null);

      await userSessionService.getSessionByClientSecretSafe({
        clientSecret: 'metorial_ses_exact_match_123',
        context: mockContext
      });

      expect(db.userSession.findFirst).toHaveBeenCalledWith({
        where: {
          clientSecret: 'metorial_ses_exact_match_123'
        },
        include: {
          user: true
        }
      });
    });
  });

  describe('edge cases', () => {
    const mockContext = { requestId: 'test-request' } as any;

    it('should handle creating multiple sessions for same user', async () => {
      const mockUser = {
        id: 'user_123',
        oid: 1,
        email: 'test@example.com'
      } as any;

      const sessions = [
        { id: 'session_1', userOid: 1, clientSecret: 'metorial_ses_1' },
        { id: 'session_2', userOid: 1, clientSecret: 'metorial_ses_2' },
        { id: 'session_3', userOid: 1, clientSecret: 'metorial_ses_3' }
      ];

      let sessionIndex = 0;
      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          userSession: {
            create: vi.fn().mockResolvedValue(sessions[sessionIndex++])
          }
        };
        return cb(mockDb);
      });

      const results = await Promise.all([
        userSessionService.createUserSession({ user: mockUser, context: mockContext }),
        userSessionService.createUserSession({ user: mockUser, context: mockContext }),
        userSessionService.createUserSession({ user: mockUser, context: mockContext })
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].clientSecret).toBe('metorial_ses_1');
      expect(results[1].clientSecret).toBe('metorial_ses_2');
      expect(results[2].clientSecret).toBe('metorial_ses_3');
    });

    it('should handle session lookup with invalid format client secret', async () => {
      db.userSession.findFirst.mockResolvedValue(null);

      const result = await userSessionService.getSessionByClientSecretSafe({
        clientSecret: 'invalid_format',
        context: mockContext
      });

      expect(result).toBeNull();
    });

    it('should handle session lookup with empty client secret', async () => {
      db.userSession.findFirst.mockResolvedValue(null);

      const result = await userSessionService.getSessionByClientSecretSafe({
        clientSecret: '',
        context: mockContext
      });

      expect(result).toBeNull();
    });

    it('should fire events in correct order during session creation', async () => {
      const mockUser = {
        id: 'user_123',
        oid: 1
      } as any;

      const mockSession = {
        id: 'session_1',
        userOid: 1,
        clientSecret: 'metorial_ses_test'
      };

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          userSession: {
            create: vi.fn().mockResolvedValue(mockSession)
          }
        };
        return cb(mockDb);
      });

      await userSessionService.createUserSession({
        user: mockUser,
        context: mockContext
      });

      const calls = Fabric.fire.mock.calls;
      expect(calls[0][0]).toBe('user.session.created:before');
      expect(calls[1][0]).toBe('user.session.created:after');
    });

    it('should fire events in correct order during session deletion', async () => {
      const mockUser = {
        id: 'user_123',
        oid: 1
      } as any;

      const mockSession = {
        oid: 10,
        id: 'session_1',
        userOid: 1
      } as any;

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          userSession: {
            delete: vi.fn().mockResolvedValue(mockSession)
          }
        };
        return cb(mockDb);
      });

      await userSessionService.deleteUserSession({
        user: mockUser,
        session: mockSession,
        context: mockContext
      });

      const calls = Fabric.fire.mock.calls;
      expect(calls[0][0]).toBe('user.session.deleted:before');
      expect(calls[1][0]).toBe('user.session.deleted:after');
    });
  });
});
