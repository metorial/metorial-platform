import { describe, expect, it, vi } from 'vitest';

// Mock the queue module
vi.mock('@metorial/queue', () => ({
  combineQueueProcessors: vi.fn((processors: any[]) => processors),
  createQueue: vi.fn((config: any) => ({
    name: config.name,
    process: vi.fn((handler: any) => ({ handler }))
  })),
  QueueRetryError: class QueueRetryError extends Error {}
}));

// Mock database
vi.mock('@metorial/db', () => ({
  db: {
    serverDeployment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    serverImplementation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn()
    },
    serverVersion: {
      findFirst: vi.fn()
    },
    providerOAuthConfig: {
      findFirstOrThrow: vi.fn(),
      findUniqueOrThrow: vi.fn()
    },
    providerOAuthConnection: {
      updateMany: vi.fn()
    },
    serverDeploymentConfig: {
      create: vi.fn(),
      update: vi.fn()
    },
    server: {
      findMany: vi.fn()
    },
    serverVariant: {
      findMany: vi.fn()
    },
    session: {
      findMany: vi.fn()
    },
    instanceServer: {
      findUnique: vi.fn(),
      createMany: vi.fn()
    }
  },
  withTransaction: vi.fn(async (fn: any) => fn({})),
  ID: {
    generateId: vi.fn(async (type: string) => `${type}-123`)
  }
}));

// Mock all other dependencies
vi.mock('@metorial/delay', () => ({
  delay: vi.fn(async () => {})
}));

vi.mock('@metorial/error', () => ({
  badRequestError: vi.fn((msg: any) => ({ type: 'bad_request', ...msg })),
  conflictError: vi.fn((msg: any) => ({ type: 'conflict', ...msg })),
  forbiddenError: vi.fn((msg: any) => ({ type: 'forbidden', ...msg })),
  notFoundError: vi.fn((type: string, id: string) => ({ type: 'not_found', resource: type, id })),
  ServiceError: class ServiceError extends Error {
    constructor(public error: any) {
      super(error.message);
    }
  }
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    fire: vi.fn(async () => {})
  }
}));

vi.mock('@metorial/module-catalog', () => ({
  serverVariantService: {
    getServerVariantById: vi.fn()
  }
}));

vi.mock('@metorial/module-engine', () => ({
  engineServerDiscoveryService: {
    discoverServerAsync: vi.fn()
  }
}));

vi.mock('@metorial/module-event', () => ({
  ingestEventService: {
    ingest: vi.fn(async () => {})
  }
}));

vi.mock('@metorial/module-provider-oauth', () => ({
  providerOauthConnectionService: {
    createConnection: vi.fn()
  },
  providerOauthDiscoveryService: {
    supportsAutoRegistration: vi.fn(),
    autoRegisterForOauthConfig: vi.fn()
  }
}));

vi.mock('@metorial/module-search', () => ({
  searchService: {
    search: vi.fn(),
    index: vi.fn()
  }
}));

vi.mock('@metorial/module-secret', () => ({
  secretService: {
    createSecret: vi.fn(),
    getSecretById: vi.fn(),
    deleteSecret: vi.fn()
  }
}));

vi.mock('@metorial/pagination', () => ({
  Paginator: {
    create: vi.fn((fn: any) => fn)
  }
}));

vi.mock('@metorial/service', () => ({
  Service: {
    create: vi.fn((name: string, factory: any) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('jsonschema', () => ({
  Validator: vi.fn().mockImplementation(() => ({
    validate: vi.fn((data: any, schema: any) => ({ valid: true, errors: [] }))
  }))
}));

vi.mock('@metorial/sentry', () => ({
  getSentry: vi.fn(() => ({
    captureException: vi.fn()
  }))
}));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((config: any) => ({
    name: config.name,
    process: vi.fn((handler: any) => ({ handler }))
  }))
}));

describe('Module Index Exports', () => {
  it('should export serverDeploymentService', async () => {
    const module = await import('../src/index');

    expect(module.serverDeploymentService).toBeDefined();
    expect(typeof module.serverDeploymentService.getServerDeploymentById).toBe('function');
    expect(typeof module.serverDeploymentService.createServerDeployment).toBe('function');
    expect(typeof module.serverDeploymentService.updateServerDeployment).toBe('function');
    expect(typeof module.serverDeploymentService.deleteServerDeployment).toBe('function');
    expect(typeof module.serverDeploymentService.listServerDeployments).toBe('function');
  });

  it('should export serverImplementationService', async () => {
    const module = await import('../src/index');

    expect(module.serverImplementationService).toBeDefined();
    expect(typeof module.serverImplementationService.getServerImplementationById).toBe('function');
    expect(typeof module.serverImplementationService.createServerImplementation).toBe('function');
    expect(typeof module.serverImplementationService.updateServerImplementation).toBe('function');
    expect(typeof module.serverImplementationService.deleteServerImplementation).toBe('function');
    expect(typeof module.serverImplementationService.listServerImplementations).toBe('function');
    expect(typeof module.serverImplementationService.ensureDefaultImplementation).toBe('function');
  });

  it('should export serverDeploymentQueueProcessor', async () => {
    const module = await import('../src/index');

    expect(module.serverDeploymentQueueProcessor).toBeDefined();
    expect(Array.isArray(module.serverDeploymentQueueProcessor)).toBe(true);
  });

  it('should export indexServerDeployments function', async () => {
    const module = await import('../src/index');

    expect(module.indexServerDeployments).toBeDefined();
    expect(typeof module.indexServerDeployments).toBe('function');
  });

  it('should combine all queue processors', async () => {
    const { combineQueueProcessors } = await import('@metorial/queue');
    const module = await import('../src/index');

    expect(combineQueueProcessors).toHaveBeenCalled();
    expect(module.serverDeploymentQueueProcessor).toBeDefined();
  });
});

describe('Queue Processors', () => {
  describe('serverDeploymentSetupQueue', () => {
    it('should be defined and process deployment setup', async () => {
      const { serverDeploymentSetupQueue } = await import(
        '../src/queues/serverDeploymentSetup'
      );

      expect(serverDeploymentSetupQueue).toBeDefined();
      expect(serverDeploymentSetupQueue.name).toBe('srd/dep/setup');
    });
  });

  describe('serverImplementationCreatedQueue', () => {
    it('should be defined and process implementation creation', async () => {
      const { serverImplementationCreatedQueue } = await import(
        '../src/queues/serverImplementationCreated'
      );

      expect(serverImplementationCreatedQueue).toBeDefined();
      expect(serverImplementationCreatedQueue.name).toBe('srd/impl/create');
    });
  });

  describe('serverDeploymentDeletedQueue', () => {
    it('should be defined', async () => {
      const { db } = await import('@metorial/db');
      const { secretService } = await import('@metorial/module-secret');

      // Mock the necessary methods
      (db.serverDeployment.findUnique as any).mockResolvedValue({
        id: 'deployment-123',
        status: 'deleted',
        config: { oid: 50, configSecretOid: 'secret-oid' },
        oauthConnectionOid: 'oauth-oid',
        instance: { oid: 1 }
      });

      (db.serverDeploymentConfig.findUnique as any) = vi.fn().mockResolvedValue({
        oid: 50,
        configSecretOid: 'secret-oid'
      });

      (db.providerOAuthConnection.findUnique as any) = vi.fn().mockResolvedValue({
        oid: 'oauth-oid',
        id: 'oauth-123'
      });

      (secretService.getSecretById as any).mockResolvedValue({
        id: 'secret-123',
        oid: 'secret-oid'
      });

      const module = await import('../src/queues/serverDeploymentDeleted');

      expect(module.serverDeploymentDeletedQueue).toBeDefined();
    });
  });
});
