import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userService } from '../src/services/user';

// Mock dependencies
vi.mock('@metorial/db', () => ({
  db: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  },
  ID: {
    generateId: vi.fn((type) => Promise.resolve(`${type}_test_id_${Date.now()}`))
  },
  withTransaction: vi.fn((cb) => cb({
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  }))
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    fire: vi.fn()
  }
}));

vi.mock('@metorial/error', () => ({
  conflictError: vi.fn((opts) => ({ type: 'conflict', ...opts })),
  forbiddenError: vi.fn((opts) => ({ type: 'forbidden', ...opts })),
  notFoundError: vi.fn((id) => ({ type: 'not_found', id })),
  notImplementedError: vi.fn((opts) => ({ type: 'not_implemented', ...opts })),
  ServiceError: class ServiceError extends Error {
    constructor(public error: any) {
      super(error.message);
    }
  }
}));

vi.mock('../src/queues/syncUserUpdate', () => ({
  syncUserUpdateQueue: {
    add: vi.fn()
  }
}));

// Mock Bun.password
global.Bun = {
  password: {
    hash: vi.fn((pwd) => Promise.resolve(`hashed_${pwd}`)),
    verify: vi.fn()
  }
} as any;

describe('userService', () => {
  let db: any;
  let Fabric: any;
  let withTransaction: any;
  let syncUserUpdateQueue: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const dbModule = await import('@metorial/db');
    db = dbModule.db;
    withTransaction = dbModule.withTransaction;

    const fabricModule = await import('@metorial/fabric');
    Fabric = fabricModule.Fabric;

    const queueModule = await import('../src/queues/syncUserUpdate');
    syncUserUpdateQueue = queueModule.syncUserUpdateQueue;
  });

  describe('createUser', () => {
    const mockContext = { requestId: 'test-request' } as any;

    it('should create a user successfully with password', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active',
        type: 'user',
        image: { type: 'default' },
        passwordHash: 'hashed_mypassword'
      };

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          user: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockUser)
          }
        };
        return cb(mockDb);
      });

      const result = await userService.createUser({
        input: {
          name: 'Test User',
          email: 'test@example.com',
          password: 'mypassword'
        },
        context: mockContext
      });

      expect(result).toEqual(mockUser);
      expect(Fabric.fire).toHaveBeenCalledWith('user.created:before', expect.any(Object));
      expect(Fabric.fire).toHaveBeenCalledWith('user.created:after', expect.objectContaining({
        user: mockUser,
        performedBy: mockUser
      }));
    });

    it('should create a user successfully without password', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active',
        type: 'user',
        image: { type: 'default' },
        passwordHash: null
      };

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          user: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockUser)
          }
        };
        return cb(mockDb);
      });

      const result = await userService.createUser({
        input: {
          name: 'Test User',
          email: 'test@example.com'
        },
        context: mockContext
      });

      expect(result.passwordHash).toBeNull();
    });

    it('should throw conflict error if user with email already exists', async () => {
      const existingUser = {
        id: 'user_existing',
        email: 'test@example.com'
      };

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          user: {
            findFirst: vi.fn().mockResolvedValue(existingUser)
          }
        };
        return cb(mockDb);
      });

      await expect(
        userService.createUser({
          input: {
            name: 'Test User',
            email: 'test@example.com',
            password: 'mypassword'
          },
          context: mockContext
        })
      ).rejects.toThrow();
    });

    it('should use custom image if provided', async () => {
      const customImage = { type: 'url', url: 'https://example.com/avatar.jpg' };
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active',
        type: 'user',
        image: customImage,
        passwordHash: null
      };

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          user: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockUser)
          }
        };
        return cb(mockDb);
      });

      const result = await userService.createUser({
        input: {
          name: 'Test User',
          email: 'test@example.com',
          image: customImage as any
        },
        context: mockContext
      });

      expect(result.image).toEqual(customImage);
    });

    it('should hash password before storing', async () => {
      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          user: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockImplementation(async ({ data }) => ({
              ...data,
              id: 'user_123'
            }))
          }
        };
        return cb(mockDb);
      });

      await userService.createUser({
        input: {
          name: 'Test User',
          email: 'test@example.com',
          password: 'mypassword'
        },
        context: mockContext
      });

      expect(global.Bun.password.hash).toHaveBeenCalledWith('mypassword');
    });
  });

  describe('updateUser', () => {
    const mockContext = { requestId: 'test-request' } as any;
    const mockUser = {
      id: 'user_123',
      email: 'old@example.com',
      name: 'Old Name',
      status: 'active'
    } as any;

    it('should update user successfully', async () => {
      const updatedUser = {
        ...mockUser,
        name: 'New Name',
        email: 'new@example.com'
      };

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          user: {
            update: vi.fn().mockResolvedValue(updatedUser)
          }
        };
        return cb(mockDb);
      });

      const result = await userService.updateUser({
        user: mockUser,
        input: {
          name: 'New Name',
          email: 'new@example.com'
        },
        context: mockContext
      });

      expect(result).toEqual(updatedUser);
      expect(Fabric.fire).toHaveBeenCalledWith('user.updated:before', expect.any(Object));
      expect(Fabric.fire).toHaveBeenCalledWith('user.updated:after', expect.objectContaining({
        user: updatedUser
      }));
      expect(syncUserUpdateQueue.add).toHaveBeenCalledWith({
        userId: updatedUser.id
      });
    });

    it('should throw forbidden error if user is not active', async () => {
      const deletedUser = {
        ...mockUser,
        status: 'deleted'
      } as any;

      await expect(
        userService.updateUser({
          user: deletedUser,
          input: {
            name: 'New Name'
          },
          context: mockContext
        })
      ).rejects.toThrow();
    });

    it('should update password and hash it', async () => {
      const updatedUser = {
        ...mockUser,
        passwordHash: 'hashed_newpassword'
      };

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          user: {
            update: vi.fn().mockResolvedValue(updatedUser)
          }
        };
        return cb(mockDb);
      });

      await userService.updateUser({
        user: mockUser,
        input: {
          password: 'newpassword'
        },
        context: mockContext
      });

      expect(global.Bun.password.hash).toHaveBeenCalledWith('newpassword');
    });

    it('should update firstName and lastName', async () => {
      const updatedUser = {
        ...mockUser,
        firstName: 'John',
        lastName: 'Doe'
      };

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          user: {
            update: vi.fn().mockResolvedValue(updatedUser)
          }
        };
        return cb(mockDb);
      });

      const result = await userService.updateUser({
        user: mockUser,
        input: {
          firstName: 'John',
          lastName: 'Doe'
        },
        context: mockContext
      });

      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
    });

    it('should update image', async () => {
      const newImage = { type: 'url', url: 'https://example.com/new-avatar.jpg' };
      const updatedUser = {
        ...mockUser,
        image: newImage
      };

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          user: {
            update: vi.fn().mockResolvedValue(updatedUser)
          }
        };
        return cb(mockDb);
      });

      const result = await userService.updateUser({
        user: mockUser,
        input: {
          image: newImage as any
        },
        context: mockContext
      });

      expect(result.image).toEqual(newImage);
    });
  });

  describe('deleteUser', () => {
    const mockContext = { requestId: 'test-request' } as any;
    const mockUser = {
      id: 'user_123',
      status: 'active'
    } as any;

    it('should throw not implemented error', async () => {
      await expect(
        userService.deleteUser({
          user: mockUser,
          context: mockContext
        })
      ).rejects.toThrow();
    });
  });

  describe('getUser', () => {
    it('should return user if found', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User'
      };

      db.user.findUnique.mockResolvedValue(mockUser);

      const result = await userService.getUser({
        userId: 'user_123'
      });

      expect(result).toEqual(mockUser);
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user_123' }
      });
    });

    it('should throw not found error if user does not exist', async () => {
      db.user.findUnique.mockResolvedValue(null);

      await expect(
        userService.getUser({
          userId: 'user_nonexistent'
        })
      ).rejects.toThrow();
    });
  });

  describe('edge cases', () => {
    const mockContext = { requestId: 'test-request' } as any;

    it('should handle email with special characters', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test+tag@example.com',
        name: 'Test User',
        status: 'active',
        type: 'user',
        image: { type: 'default' }
      };

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          user: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockUser)
          }
        };
        return cb(mockDb);
      });

      const result = await userService.createUser({
        input: {
          name: 'Test User',
          email: 'test+tag@example.com'
        },
        context: mockContext
      });

      expect(result.email).toBe('test+tag@example.com');
    });

    it('should handle very long names', async () => {
      const longName = 'A'.repeat(500);
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        name: longName,
        status: 'active',
        type: 'user',
        image: { type: 'default' }
      };

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          user: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockUser)
          }
        };
        return cb(mockDb);
      });

      const result = await userService.createUser({
        input: {
          name: longName,
          email: 'test@example.com'
        },
        context: mockContext
      });

      expect(result.name).toBe(longName);
    });

    it('should handle concurrent user updates', async () => {
      const mockUser = {
        id: 'user_123',
        status: 'active'
      } as any;

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          user: {
            update: vi.fn().mockResolvedValue({ ...mockUser, name: 'Updated' })
          }
        };
        return cb(mockDb);
      });

      const promises = Array.from({ length: 5 }, (_, i) =>
        userService.updateUser({
          user: mockUser,
          input: { name: `Name ${i}` },
          context: mockContext
        })
      );

      await Promise.all(promises);

      expect(syncUserUpdateQueue.add).toHaveBeenCalledTimes(5);
    });

    it('should handle empty string values in update', async () => {
      const mockUser = {
        id: 'user_123',
        status: 'active',
        name: 'Old Name'
      } as any;

      const updatedUser = {
        ...mockUser,
        name: '',
        firstName: ''
      };

      withTransaction.mockImplementation(async (cb: any) => {
        const mockDb = {
          user: {
            update: vi.fn().mockResolvedValue(updatedUser)
          }
        };
        return cb(mockDb);
      });

      const result = await userService.updateUser({
        user: mockUser,
        input: {
          name: '',
          firstName: ''
        },
        context: mockContext
      });

      expect(result.name).toBe('');
      expect(result.firstName).toBe('');
    });
  });
});
