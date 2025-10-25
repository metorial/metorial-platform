import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userAuthService } from '../src/services/userAuth';

// Mock dependencies
vi.mock('@metorial/db', () => ({
  db: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn()
    }
  },
  withTransaction: vi.fn((cb) => cb({
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn()
    }
  }))
}));

vi.mock('@metorial/error', () => ({
  badRequestError: vi.fn((opts) => ({ type: 'bad_request', ...opts })),
  unauthorizedError: vi.fn((opts) => ({ type: 'unauthorized', ...opts })),
  ServiceError: class ServiceError extends Error {
    constructor(public error: any) {
      super(error.message);
    }
  }
}));

vi.mock('../src/services/user', () => ({
  userService: {
    createUser: vi.fn(),
    getUser: vi.fn()
  }
}));

vi.mock('../src/services/userSession', () => ({
  userSessionService: {
    createUserSession: vi.fn(),
    deleteUserSession: vi.fn(),
    getSessionByClientSecretSafe: vi.fn()
  }
}));

// Mock Bun.password
global.Bun = {
  password: {
    hash: vi.fn((pwd) => Promise.resolve(`hashed_${pwd}`)),
    verify: vi.fn()
  }
} as any;

describe('userAuthService', () => {
  let db: any;
  let withTransaction: any;
  let userService: any;
  let userSessionService: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const dbModule = await import('@metorial/db');
    db = dbModule.db;
    withTransaction = dbModule.withTransaction;

    const userServiceModule = await import('../src/services/user');
    userService = userServiceModule.userService;

    const userSessionModule = await import('../src/services/userSession');
    userSessionService = userSessionModule.userSessionService;
  });

  describe('loginWithPassword', () => {
    const mockContext = { requestId: 'test-request' } as any;

    it('should login successfully with valid credentials', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        passwordHash: 'hashed_password123'
      };

      const mockSession = {
        id: 'session_123',
        clientSecret: 'metorial_ses_abc123'
      };

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          user: {
            findFirst: vi.fn().mockResolvedValue(mockUser)
          }
        };
        return cb(mockDb);
      });

      (global.Bun.password.verify as any).mockResolvedValue(true);
      userSessionService.createUserSession.mockResolvedValue(mockSession);

      const result = await userAuthService.loginWithPassword({
        input: {
          email: 'test@example.com',
          password: 'password123'
        },
        context: mockContext
      });

      expect(result).toEqual(mockSession);
      expect(global.Bun.password.verify).toHaveBeenCalledWith('password123', 'hashed_password123');
      expect(userSessionService.createUserSession).toHaveBeenCalledWith({
        user: mockUser,
        context: mockContext
      });
    });

    it('should throw error if user not found', async () => {
      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          user: {
            findFirst: vi.fn().mockResolvedValue(null)
          }
        };
        return cb(mockDb);
      });

      await expect(
        userAuthService.loginWithPassword({
          input: {
            email: 'nonexistent@example.com',
            password: 'password123'
          },
          context: mockContext
        })
      ).rejects.toThrow();
    });

    it('should throw error if password is invalid', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        passwordHash: 'hashed_password123'
      };

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          user: {
            findFirst: vi.fn().mockResolvedValue(mockUser)
          }
        };
        return cb(mockDb);
      });

      (global.Bun.password.verify as any).mockResolvedValue(false);

      await expect(
        userAuthService.loginWithPassword({
          input: {
            email: 'test@example.com',
            password: 'wrongpassword'
          },
          context: mockContext
        })
      ).rejects.toThrow();
    });

    it('should throw error if user has no password hash', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        passwordHash: null
      };

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          user: {
            findFirst: vi.fn().mockResolvedValue(mockUser)
          }
        };
        return cb(mockDb);
      });

      await expect(
        userAuthService.loginWithPassword({
          input: {
            email: 'test@example.com',
            password: 'password123'
          },
          context: mockContext
        })
      ).rejects.toThrow();
    });

    it('should search for user by email', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        passwordHash: 'hashed_password123'
      };

      let capturedWhere: any;

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          user: {
            findFirst: vi.fn().mockImplementation(({ where }) => {
              capturedWhere = where;
              return Promise.resolve(mockUser);
            })
          }
        };
        return cb(mockDb);
      });

      (global.Bun.password.verify as any).mockResolvedValue(true);
      userSessionService.createUserSession.mockResolvedValue({});

      await userAuthService.loginWithPassword({
        input: {
          email: 'test@example.com',
          password: 'password123'
        },
        context: mockContext
      });

      expect(capturedWhere).toEqual({ email: 'test@example.com' });
    });
  });

  describe('signupWithPassword', () => {
    const mockContext = { requestId: 'test-request' } as any;

    it('should signup successfully', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'new@example.com',
        name: 'New User'
      };

      const mockSession = {
        id: 'session_123',
        clientSecret: 'metorial_ses_abc123'
      };

      withTransaction.mockImplementation(async (cb: any) => cb({}));
      userService.createUser.mockResolvedValue(mockUser);
      userSessionService.createUserSession.mockResolvedValue(mockSession);

      const result = await userAuthService.signupWithPassword({
        input: {
          name: 'New User',
          email: 'new@example.com',
          password: 'password123'
        },
        context: mockContext
      });

      expect(result).toEqual(mockSession);
      expect(userService.createUser).toHaveBeenCalledWith({
        input: {
          name: 'New User',
          email: 'new@example.com',
          password: 'password123'
        },
        context: mockContext
      });
      expect(userSessionService.createUserSession).toHaveBeenCalledWith({
        user: mockUser,
        context: mockContext
      });
    });

    it('should create session after user creation', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'new@example.com'
      };

      const mockSession = {
        id: 'session_123'
      };

      withTransaction.mockImplementation(async (cb: any) => cb({}));
      userService.createUser.mockResolvedValue(mockUser);
      userSessionService.createUserSession.mockResolvedValue(mockSession);

      await userAuthService.signupWithPassword({
        input: {
          name: 'New User',
          email: 'new@example.com',
          password: 'password123'
        },
        context: mockContext
      });

      // Verify createUser was called before createUserSession
      const createUserCall = userService.createUser.mock.invocationCallOrder[0];
      const createSessionCall = userSessionService.createUserSession.mock.invocationCallOrder[0];
      expect(createUserCall).toBeLessThan(createSessionCall);
    });
  });

  describe('authenticateWithSessionSecret', () => {
    const mockContext = { requestId: 'test-request' } as any;

    it('should authenticate successfully with valid session secret', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User'
      };

      const mockSession = {
        id: 'session_123',
        clientSecret: 'metorial_ses_abc123',
        user: mockUser
      };

      userSessionService.getSessionByClientSecretSafe.mockResolvedValue(mockSession);

      const result = await userAuthService.authenticateWithSessionSecret({
        sessionClientSecret: 'metorial_ses_abc123',
        context: mockContext
      });

      expect(result).toEqual({
        session: mockSession,
        user: mockUser
      });
      expect(userSessionService.getSessionByClientSecretSafe).toHaveBeenCalledWith({
        clientSecret: 'metorial_ses_abc123',
        context: mockContext
      });
    });

    it('should throw unauthorized error if session not found', async () => {
      userSessionService.getSessionByClientSecretSafe.mockResolvedValue(null);

      await expect(
        userAuthService.authenticateWithSessionSecret({
          sessionClientSecret: 'metorial_ses_invalid',
          context: mockContext
        })
      ).rejects.toThrow();
    });

    it('should return both session and user', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com'
      };

      const mockSession = {
        id: 'session_123',
        user: mockUser
      };

      userSessionService.getSessionByClientSecretSafe.mockResolvedValue(mockSession);

      const result = await userAuthService.authenticateWithSessionSecret({
        sessionClientSecret: 'metorial_ses_test',
        context: mockContext
      });

      expect(result.session).toEqual(mockSession);
      expect(result.user).toEqual(mockUser);
    });
  });

  describe('DANGEROUSLY_authenticateWithUserId', () => {
    const mockContext = { requestId: 'test-request' } as any;

    it('should authenticate successfully with valid user id', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User'
      };

      userService.getUser.mockResolvedValue(mockUser);

      const result = await userAuthService.DANGEROUSLY_authenticateWithUserId({
        userId: 'user_123',
        context: mockContext
      });

      expect(result).toEqual({
        user: mockUser
      });
      expect(userService.getUser).toHaveBeenCalledWith({
        userId: 'user_123'
      });
    });

    it('should throw if user not found', async () => {
      userService.getUser.mockRejectedValue(new Error('User not found'));

      await expect(
        userAuthService.DANGEROUSLY_authenticateWithUserId({
          userId: 'user_nonexistent',
          context: mockContext
        })
      ).rejects.toThrow();
    });
  });

  describe('logout', () => {
    const mockContext = { requestId: 'test-request' } as any;

    it('should logout successfully', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com'
      } as any;

      const mockSession = {
        id: 'session_123',
        user: mockUser
      } as any;

      const deletedSession = {
        ...mockSession,
        deletedAt: new Date()
      };

      userSessionService.deleteUserSession.mockResolvedValue(deletedSession);

      const result = await userAuthService.logout({
        context: mockContext,
        session: mockSession
      });

      expect(result).toEqual(deletedSession);
      expect(userSessionService.deleteUserSession).toHaveBeenCalledWith({
        user: mockUser,
        session: mockSession,
        context: mockContext
      });
    });

    it('should delete the correct session', async () => {
      const mockUser = {
        id: 'user_123'
      } as any;

      const mockSession = {
        id: 'session_456',
        oid: 789,
        user: mockUser
      } as any;

      userSessionService.deleteUserSession.mockResolvedValue(mockSession);

      await userAuthService.logout({
        context: mockContext,
        session: mockSession
      });

      expect(userSessionService.deleteUserSession).toHaveBeenCalledWith(
        expect.objectContaining({
          session: expect.objectContaining({
            id: 'session_456',
            oid: 789
          })
        })
      );
    });
  });

  describe('edge cases', () => {
    const mockContext = { requestId: 'test-request' } as any;

    it('should handle case-sensitive email in login', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'Test@Example.COM',
        passwordHash: 'hashed_password123'
      };

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          user: {
            findFirst: vi.fn().mockResolvedValue(mockUser)
          }
        };
        return cb(mockDb);
      });

      (global.Bun.password.verify as any).mockResolvedValue(true);
      userSessionService.createUserSession.mockResolvedValue({});

      await userAuthService.loginWithPassword({
        input: {
          email: 'Test@Example.COM',
          password: 'password123'
        },
        context: mockContext
      });

      expect(userSessionService.createUserSession).toHaveBeenCalled();
    });

    it('should handle empty password in login', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        passwordHash: 'hashed_password123'
      };

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          user: {
            findFirst: vi.fn().mockResolvedValue(mockUser)
          }
        };
        return cb(mockDb);
      });

      (global.Bun.password.verify as any).mockResolvedValue(false);

      await expect(
        userAuthService.loginWithPassword({
          input: {
            email: 'test@example.com',
            password: ''
          },
          context: mockContext
        })
      ).rejects.toThrow();
    });

    it('should handle concurrent login attempts', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        passwordHash: 'hashed_password123'
      };

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          user: {
            findFirst: vi.fn().mockResolvedValue(mockUser)
          }
        };
        return cb(mockDb);
      });

      (global.Bun.password.verify as any).mockResolvedValue(true);
      userSessionService.createUserSession.mockResolvedValue({ id: 'session_123' });

      const promises = Array.from({ length: 5 }, () =>
        userAuthService.loginWithPassword({
          input: {
            email: 'test@example.com',
            password: 'password123'
          },
          context: mockContext
        })
      );

      await Promise.all(promises);

      expect(userSessionService.createUserSession).toHaveBeenCalledTimes(5);
    });

    it('should handle very long password', async () => {
      const longPassword = 'a'.repeat(1000);
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        passwordHash: 'hashed_long_password'
      };

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          user: {
            findFirst: vi.fn().mockResolvedValue(mockUser)
          }
        };
        return cb(mockDb);
      });

      (global.Bun.password.verify as any).mockResolvedValue(true);
      userSessionService.createUserSession.mockResolvedValue({});

      await userAuthService.loginWithPassword({
        input: {
          email: 'test@example.com',
          password: longPassword
        },
        context: mockContext
      });

      expect(global.Bun.password.verify).toHaveBeenCalledWith(longPassword, 'hashed_long_password');
    });

    it('should handle authentication with expired or invalid session format', async () => {
      userSessionService.getSessionByClientSecretSafe.mockResolvedValue(null);

      await expect(
        userAuthService.authenticateWithSessionSecret({
          sessionClientSecret: 'expired_or_malformed',
          context: mockContext
        })
      ).rejects.toThrow();
    });
  });
});
