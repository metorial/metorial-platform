import { vi } from 'vitest';

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
    cityHash32: vi.fn((str: any) => 12345)
  }
};
