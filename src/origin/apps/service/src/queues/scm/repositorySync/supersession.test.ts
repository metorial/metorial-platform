import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, transition, snapshot, exportFiles, lock, merge } = vi.hoisted(() => ({
  db: { scmRepositorySync: { findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() } },
  transition: vi.fn(),
  snapshot: vi.fn(),
  exportFiles: vi.fn(),
  lock: vi.fn(),
  merge: vi.fn()
}));

vi.mock('../../../db', () => ({ db }));
vi.mock('../../../env', () => ({ env: { service: { REDIS_URL: 'unused' } } }));
vi.mock('@lowerdeck/queue', () => ({
  createQueue: () => ({ process: (run: unknown) => run })
}));
vi.mock('../../../lib/repositorySyncWriteLock', () => ({
  withRepositorySyncWriteLock: (run: (data: unknown) => unknown) => async (data: unknown) => {
    lock();
    return run(data);
  }
}));
vi.mock('../../../services', () => ({
  codeBucketService: { exportCodeBucketToRepoNow: exportFiles }
}));
vi.mock('../../../services/repositorySyncState', () => ({
  transitionRepositorySyncState: transition
}));
vi.mock('../../../lib/scmRepositorySyncProvider', () => ({
  getRepositorySyncStatusSnapshot: snapshot,
  mergeRepositorySyncPullRequest: merge
}));
vi.mock('./createPr', () => ({ createPrRepositorySyncQueue: {} }));
vi.mock('./_lib', () => ({
  logRepositorySyncQueueEvent: vi.fn(),
  logRepositorySyncQueueError: vi.fn(),
  appendRepositorySyncLog: vi.fn(),
  markRepositorySyncFailed: vi.fn()
}));

import { mergeRepositorySyncQueueProcessor } from './merge';
import { syncContentsRepositorySyncQueueProcessor } from './syncContents';

let row = { id: 'old', oid: 1n, repoOid: 10n, codeBucketOid: 20n, status: 'merging' };

describe('superseded repository side effects', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    snapshot.mockResolvedValue({ pullRequest: { state: 'open' } });
    db.scmRepositorySync.updateMany.mockResolvedValue({ count: 1 });
    db.scmRepositorySync.findFirst.mockImplementation(async input => {
      if (input.where.oid?.gt) return { id: 'newer' };
      if (input.where.repositoryAccessMode === 'default_branch') return null;
      return row;
    });
  });

  it.each([
    ['merge', mergeRepositorySyncQueueProcessor],
    ['file export', syncContentsRepositorySyncQueueProcessor]
  ])('cancels stale %s work before reaching the provider', async (_label, processor) => {
    let run = processor as unknown as (data: { syncId: string }) => Promise<void>;

    await run({ syncId: 'old' });

    expect(lock).toHaveBeenCalledOnce();
    expect(transition).toHaveBeenCalledWith(
      'old',
      'merging',
      expect.objectContaining({
        status: 'cancelled',
        completedAt: expect.any(Date)
      })
    );
    expect(merge).not.toHaveBeenCalled();
    expect(exportFiles).not.toHaveBeenCalled();
  });
});
