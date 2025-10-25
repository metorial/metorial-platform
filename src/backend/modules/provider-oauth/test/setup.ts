import { vi } from 'vitest';

// Mock config to avoid environment validation errors
vi.mock('@metorial/config', () => ({
  getConfig: vi.fn(() => ({
    urls: {
      providerOauthUrl: 'https://test.example.com'
    }
  }))
}));

// Mock environment to avoid ENV validation errors
vi.mock('@metorial/env', () => ({
  getEnv: vi.fn(() => ({
    REDIS_URL: 'redis://localhost:6379',
    DATABASE_URL: 'postgresql://localhost:5432/test'
  })),
  createValidatedEnv: vi.fn(() => ({
    ticket: {
      PROVIDER_OAUTH_TICKET_SECRET: 'test-secret',
      PROVIDER_OAUTH_URL: 'https://test.example.com'
    }
  }))
}));

// Mock bun package for vitest
vi.mock('bun', () => ({
  deepEquals: vi.fn((a, b) => JSON.stringify(a) === JSON.stringify(b))
}));
