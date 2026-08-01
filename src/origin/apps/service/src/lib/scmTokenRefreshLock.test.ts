import { expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  let usingLock = vi.fn(async (_key: string, fn: () => Promise<unknown>) => await fn());
  return {
    usingLock,
    createLock: vi.fn(() => ({ usingLock }))
  };
});

vi.mock('@lowerdeck/lock', () => ({ createLock: mocks.createLock }));
vi.mock('../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost' } }
}));

import { usingScmTokenRefreshLock } from './scmTokenRefreshLock';

it('locks token refreshes by provider and installation', async () => {
  await expect(
    usingScmTokenRefreshLock('gitlab', 42n, async () => 'access-token')
  ).resolves.toBe('access-token');

  expect(mocks.createLock).toHaveBeenCalledWith({
    name: 'origin/scm/token-refresh',
    redisUrl: 'redis://localhost'
  });
  expect(mocks.usingLock).toHaveBeenCalledWith('gitlab:42', expect.any(Function));
});
