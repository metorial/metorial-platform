import { beforeEach, expect, it, vi } from 'vitest';

let { findUnique, usingLock } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  usingLock: vi.fn()
}));

vi.mock('../db', () => ({ db: { scmRepositorySync: { findUnique } } }));
vi.mock('../env', () => ({ env: { service: { REDIS_URL: 'unused' } } }));
vi.mock('@lowerdeck/lock', () => ({ createLock: () => ({ usingLock }) }));

import { withRepositorySyncWriteLock } from './repositorySyncWriteLock';

beforeEach(() => {
  vi.resetAllMocks();
  usingLock.mockImplementation(async (_key, run) => await run());
});

it('serializes different sync IDs through the same repository lock key', async () => {
  findUnique.mockResolvedValue({ repoOid: 42n });
  let work = vi.fn();
  let run = withRepositorySyncWriteLock(work);

  await run({ syncId: 'old' });
  await run({ syncId: 'new' });

  expect(usingLock.mock.calls.map(([key]) => key)).toEqual(['42', '42']);
  expect(work).toHaveBeenCalledTimes(2);
});

it('ignores a sync deleted before its job ran', async () => {
  findUnique.mockResolvedValue(null);
  let work = vi.fn();

  await withRepositorySyncWriteLock(work)({ syncId: 'deleted' });

  expect(usingLock).not.toHaveBeenCalled();
  expect(work).not.toHaveBeenCalled();
});
