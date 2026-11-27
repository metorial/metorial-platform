import { vi } from 'vitest';

vi.mock('@metorial/cache', async () => (await import('./_mocks')).cacheModule);
vi.mock(
  '@metorial/module-agent-tracking-sync',
  async () => (await import('./_mocks')).syncModule
);
vi.mock('@metorial/db', async () => (await import('./_mocks')).dbModule);
vi.mock(
  '@metorial/module-consumer-core',
  async () => (await import('./_mocks')).consumerCoreModule
);
vi.mock(
  '@metorial-subspace/module-session',
  async () => (await import('./_mocks')).sessionModule
);
vi.mock(
  '@metorial-subspace/module-connection',
  async () => (await import('./_mocks')).connectionModule
);
vi.mock(
  '@metorial-subspace/module-catalog',
  async () => (await import('./_mocks')).catalogModule
);
