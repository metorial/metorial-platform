import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  queryRaw: vi.fn()
}));

vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: class PrismaPg {}
}));

vi.mock('../../prisma/generated/client.js', () => ({
  PrismaClient: class PrismaClient {
    $queryRaw = mocks.queryRaw;
  }
}));

vi.mock('../env', () => ({
  env: {
    service: {
      GLOBAL_DB_CONNECTION_TIMEOUT_MS: 10,
      GLOBAL_DB_KEEPALIVE_INTERVAL_MS: 60_000,
      GLOBAL_DB_POOL_IDLE_TIMEOUT_MS: 60_000,
      GLOBAL_DB_READY_MAX_ATTEMPTS: 3,
      GLOBAL_DB_READY_RETRY_BASE_MS: 1,
      GLOBAL_DB_READY_RETRY_MAX_MS: 1
    }
  }
}));

describe('global database readiness', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.queryRaw.mockReset();
    process.env.GLOBAL_DATABASE_URL = 'postgres://test:test@localhost:5432/test';
    delete process.env.GLOBAL_DATABASE_ARN;
  });

  afterEach(async () => {
    let { stopGlobalDatabaseKeepalive } = await import('./index');
    stopGlobalDatabaseKeepalive();
  });

  it('shares readiness work and retries a failed initial connection', async () => {
    mocks.queryRaw.mockRejectedValueOnce(new Error('not ready')).mockResolvedValueOnce([]);

    let { ensureGlobalDatabaseReady } = await import('./index');
    let first = ensureGlobalDatabaseReady();
    let second = ensureGlobalDatabaseReady();

    expect(first).toBe(second);
    await expect(first).resolves.toBeUndefined();
    expect(mocks.queryRaw).toHaveBeenCalledTimes(2);
  });
});
