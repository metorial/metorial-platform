import { vi } from 'vitest';

vi.mock('@metorial/cache', async () => (await import('./_mocks')).cacheModule);
vi.mock(
  '@metorial/module-agent-tracking-sync',
  async () => (await import('./_mocks')).syncModule
);
vi.mock('@metorial/db', async () => (await import('./_mocks')).dbModule);
