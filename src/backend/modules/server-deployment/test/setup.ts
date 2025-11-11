import { vi } from 'vitest';

// Mock ioredis to prevent Redis connection attempts
vi.mock('ioredis', () => {
  const RedisMock: any = vi.fn(() => ({
    on: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    quit: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    setex: vi.fn(),
    expire: vi.fn()
  }));
  RedisMock.Cluster = vi.fn(() => ({
    on: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    quit: vi.fn()
  }));
  return { default: RedisMock, Redis: RedisMock };
});

const mockEnvStructure = {
  config: {
    REDIS_URL: 'redis://localhost:6379',
    DATABASE_URL: 'postgresql://localhost:5432/test',
    EMAIL_FROM: 'test@example.com',
    EMAIL_FROM_NAME: 'Test Name',
    SMTP_HOST: 'localhost',
    SMTP_PORT: '587',
    SMTP_USER: 'test',
    SMTP_PASSWORD: 'test',
    SMTP_SECURE: 'false',
    STORAGE_SERVICE_ADDRESS: 'http://localhost:3001',
    ENGINE_SERVICE_ADDRESS: 'http://localhost:3002',
    APP_URL: 'http://localhost:3003',
    API_URL: 'https://test.example.com'
  },
  codeWorkspace: {
    CODE_WORKSPACE_SERVICE_ADDRESS: 'http://localhost:3000'
  },
  deno: {
    DENO_DEPLOY_TOKEN: '',
    DENO_RUNNER_ADDRESS: ''
  },
  email: {
    type: 'smtp',
    from: 'test@example.com',
    fromName: 'Test',
    host: 'localhost',
    port: 587,
    secure: false,
    auth: {
      user: 'test',
      pass: 'test'
    }
  },
  aws: {
    AWS_REGION: 'us-east-1',
    AWS_ACCOUNT_ID: '123456789012',
    AWS_ACCESS_KEY_ID: '',
    AWS_SECRET_ACCESS_KEY: '',
    LAMBDA_DEPLOY_RESOURCE_PREFIX: 'test'
  }
};

// Mock config to avoid environment validation errors
vi.mock('@metorial/config', () => ({
  getConfig: vi.fn(() => ({
    urls: {
      apiUrl: 'https://test.example.com',
      appUrl: 'https://test.example.com'
    },
    email: mockEnvStructure.email,
    redisUrl: 'redis://localhost:6379'
  })),
  env: mockEnvStructure
}));

// Mock environment to avoid ENV validation errors
vi.mock('@metorial/env', () => ({
  getEnv: vi.fn(() => mockEnvStructure),
  createValidatedEnv: vi.fn(() => mockEnvStructure),
  env: mockEnvStructure
}));

// Mock cron to avoid REDIS_URL parsing issues
vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((config: any) => ({
    name: config.name,
    process: vi.fn((handler: any) => ({ handler }))
  }))
}));

// Mock queue to avoid REDIS_URL parsing issues
vi.mock('@metorial/queue', () => ({
  combineQueueProcessors: vi.fn((processors: any[]) => processors),
  createQueue: vi.fn((config: any) => ({
    name: config.name,
    process: vi.fn((handler: any) => ({ handler })),
    add: vi.fn(async () => {})
  })),
  QueueRetryError: class QueueRetryError extends Error {}
}));

// Mock bun package for vitest
vi.mock('bun', () => ({
  deepEquals: vi.fn((a, b) => JSON.stringify(a) === JSON.stringify(b))
}));

// Mock Bun global for vitest
(global as any).Bun = {
  hash: {
    cityHash32: vi.fn((_str: any) => 12345)
  }
};

// Mock @metorial/db to prevent Prisma connection attempts
vi.mock('@metorial/db', () => ({
  db: {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn((fn: any) => fn({
      serverDeployment: {
        create: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn()
      },
      serverDeploymentConfig: {
        create: vi.fn(),
        update: vi.fn()
      }
    })),
    serverDeployment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
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
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    providerOAuthConfig: {
      findFirstOrThrow: vi.fn(),
      findUniqueOrThrow: vi.fn()
    },
    providerOAuthConnection: {
      updateMany: vi.fn(),
      findUnique: vi.fn()
    },
    serverDeploymentConfig: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn()
    },
    serverConfigVault: {
      findFirst: vi.fn()
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
    },
    profile: {
      upsert: vi.fn()
    }
  },
  withTransaction: vi.fn(async (fn: any) => {
    return fn({
      serverDeployment: {
        create: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn()
      },
      serverDeploymentConfig: {
        create: vi.fn(),
        update: vi.fn()
      },
      serverConfigVault: {
        findFirst: vi.fn()
      },
      providerOAuthConfig: {
        findFirstOrThrow: vi.fn(),
        findUniqueOrThrow: vi.fn()
      },
      providerOAuthConnection: {
        updateMany: vi.fn()
      }
    });
  }),
  ID: {
    generateId: vi.fn(async (type: string) => `${type}-123`)
  },
  ensureEmailIdentity: vi.fn(async (factory: any) => factory())
}));
