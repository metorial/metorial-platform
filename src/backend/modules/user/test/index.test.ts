import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies before importing
vi.mock('@metorial/queue', () => ({
  combineQueueProcessors: vi.fn((processors) => ({
    type: 'combined',
    processors
  })),
  createQueue: vi.fn((config) => ({
    name: config.name,
    add: vi.fn(),
    addMany: vi.fn(),
    process: vi.fn((handler) => ({
      type: 'processor',
      handler
    }))
  }))
}));

vi.mock('@metorial/db', () => ({
  db: {
    user: {},
    userSession: {},
    organizationMember: {},
    organizationActor: {}
  },
  ID: {
    generateId: vi.fn()
  },
  withTransaction: vi.fn()
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    fire: vi.fn()
  }
}));

vi.mock('@metorial/error', () => ({
  conflictError: vi.fn(),
  forbiddenError: vi.fn(),
  notFoundError: vi.fn(),
  notImplementedError: vi.fn(),
  badRequestError: vi.fn(),
  unauthorizedError: vi.fn(),
  ServiceError: class ServiceError extends Error {}
}));

vi.mock('@metorial/service', () => ({
  Service: {
    create: vi.fn(() => ({
      build: vi.fn(() => ({}))
    }))
  }
}));

vi.mock('@metorial/id', () => ({
  generateCustomId: vi.fn()
}));

// Mock Bun
global.Bun = {
  password: {
    hash: vi.fn(),
    verify: vi.fn()
  }
} as any;

describe('user module exports', () => {
  let combineQueueProcessors: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const queueModule = await import('@metorial/queue');
    combineQueueProcessors = queueModule.combineQueueProcessors;
  });

  it('should export userService', async () => {
    const { userService } = await import('../src/services/user');
    expect(userService).toBeDefined();
  });

  it('should export userSessionService', async () => {
    const { userSessionService } = await import('../src/services/userSession');
    expect(userSessionService).toBeDefined();
  });

  it('should export userAuthService', async () => {
    const { userAuthService } = await import('../src/services/userAuth');
    expect(userAuthService).toBeDefined();
  });

  it('should export userQueueProcessor', async () => {
    const { userQueueProcessor } = await import('../src/index');
    expect(userQueueProcessor).toBeDefined();
  });

  it('should export services from main module', async () => {
    const module = await import('../src/index');
    expect(module.userService).toBeDefined();
    expect(module.userSessionService).toBeDefined();
    expect(module.userAuthService).toBeDefined();
  });

  it('should have userQueueProcessor defined', async () => {
    const { userQueueProcessor } = await import('../src/index');
    expect(userQueueProcessor).toBeDefined();
  });

  it('should export syncUserUpdateQueue', async () => {
    const { syncUserUpdateQueue } = await import('../src/queues/syncUserUpdate');
    expect(syncUserUpdateQueue).toBeDefined();
  });

  it('should export syncUserUpdateSingleQueue', async () => {
    const { syncUserUpdateSingleQueue } = await import('../src/queues/syncUserUpdate');
    expect(syncUserUpdateSingleQueue).toBeDefined();
  });

  it('should export syncUserUpdateQueueProcessor', async () => {
    const { syncUserUpdateQueueProcessor } = await import('../src/queues/syncUserUpdate');
    expect(syncUserUpdateQueueProcessor).toBeDefined();
  });

  it('should export syncUserUpdateSingleQueueProcessor', async () => {
    const { syncUserUpdateSingleQueueProcessor } = await import('../src/queues/syncUserUpdate');
    expect(syncUserUpdateSingleQueueProcessor).toBeDefined();
  });

  it('should have userQueueProcessor as combined processor', async () => {
    const { userQueueProcessor } = await import('../src/index');
    expect(userQueueProcessor).toHaveProperty('type', 'combined');
    expect(userQueueProcessor).toHaveProperty('processors');
  });

  it('should include both queue processors in userQueueProcessor', async () => {
    vi.resetModules();

    const queueModule = await import('@metorial/queue');
    combineQueueProcessors = queueModule.combineQueueProcessors;

    // Re-import to trigger the module initialization
    await import('../src/index');

    expect(combineQueueProcessors).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.anything(),
        expect.anything()
      ])
    );
  });
});

describe('service integration', () => {
  it('should have userService methods', async () => {
    const { userService } = await import('../src/services/user');
    // Methods are on the service instance created by Service.create().build()
    // We just verify the service exists
    expect(userService).toBeDefined();
  });

  it('should have userSessionService methods', async () => {
    const { userSessionService } = await import('../src/services/userSession');
    expect(userSessionService).toBeDefined();
  });

  it('should have userAuthService methods', async () => {
    const { userAuthService } = await import('../src/services/userAuth');
    expect(userAuthService).toBeDefined();
  });
});

describe('queue names', () => {
  it('should have correct queue name for syncUserUpdateQueue', async () => {
    const { syncUserUpdateQueue } = await import('../src/queues/syncUserUpdate');
    expect(syncUserUpdateQueue.name).toBe('usr/syncUserUpdate');
  });

  it('should have correct queue name for syncUserUpdateSingleQueue', async () => {
    const { syncUserUpdateSingleQueue } = await import('../src/queues/syncUserUpdate');
    expect(syncUserUpdateSingleQueue.name).toBe('usr/syncUserUpdateSingle');
  });
});
