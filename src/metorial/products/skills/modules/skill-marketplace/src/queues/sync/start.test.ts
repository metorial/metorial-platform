import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, collect, log, locked, available } = vi.hoisted(() => ({
  db: {
    skillDestinationSync: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    skillDestination: { update: vi.fn() }
  },
  collect: vi.fn(),
  log: vi.fn(),
  locked: vi.fn(),
  available: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db,
  withTransaction: async (run: (tx: typeof db) => unknown) => run(db)
}));
vi.mock('@metorial/queue', () => ({
  createQueue: () => ({ process: (run: unknown) => run }),
  QueueRetryError: Error
}));
vi.mock('./_lib/lock', () => ({
  withDestinationSyncLock: (run: (data: unknown) => unknown) => async (data: unknown) => {
    locked();
    return run(data);
  }
}));
vi.mock('./_lib/bucket', () => ({ destinationBucketIsAvailable: available }));
vi.mock('./propagate', () => ({ syncPropagateStartQueue: { add: vi.fn() } }));
vi.mock('./collect', () => ({ syncCollectQueue: { add: collect } }));
vi.mock('./_lib/logs', () => ({ appendSkillDestinationSyncLog: log }));

import { syncStartQueueProcessor } from './start';

let run = syncStartQueueProcessor as unknown as (data: {
  skillDestinationSyncId: string;
}) => Promise<void>;

let sync = {
  oid: 20n,
  id: 'sync_1',
  status: 'pending',
  isAtRepoSyncStage: false,
  destinationOid: 10n,
  destination: { tag: 2 }
};

describe('sync start', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.skillDestinationSync.findUnique.mockResolvedValue(sync);
    available.mockResolvedValue(true);
  });

  it('only cancels older syncs and preserves changes recorded after scheduling', async () => {
    await run({ skillDestinationSyncId: sync.id });

    expect(locked).toHaveBeenCalledOnce();
    expect(db.skillDestinationSync.updateMany).toHaveBeenCalledWith({
      where: {
        oid: { lt: 20n },
        status: { in: ['pending', 'processing'] },
        destinationOid: 10n,
        isAtRepoSyncStage: false
      },
      data: { status: 'canceled', completedAt: expect.any(Date) }
    });
    expect(db.skillDestination.update).toHaveBeenCalledWith({
      where: { oid: 10n },
      data: { tag: { increment: 1 } }
    });
  });

  it('resumes dispatch after a previous attempt already claimed the sync', async () => {
    db.skillDestinationSync.findUnique.mockResolvedValue({ ...sync, status: 'processing' });

    await run({ skillDestinationSyncId: sync.id });

    expect(collect).toHaveBeenCalledOnce();
    expect(db.skillDestinationSync.update).not.toHaveBeenCalled();
  });

  it('does not revive an older sync after newer work has started', async () => {
    db.skillDestinationSync.findFirst.mockResolvedValue({ id: 'newer' });

    await run({ skillDestinationSyncId: sync.id });

    expect(collect).not.toHaveBeenCalled();
    expect(db.skillDestinationSync.update).toHaveBeenCalledWith({
      where: { oid: sync.oid },
      data: { status: 'canceled', completedAt: expect.any(Date) }
    });
  });

  it('leaves a newer sync pending while Origin is reading the shared bucket', async () => {
    available.mockResolvedValue(false);

    await run({ skillDestinationSyncId: sync.id });

    expect(collect).not.toHaveBeenCalled();
    expect(db.skillDestinationSync.update).not.toHaveBeenCalled();
    expect(db.skillDestination.update).not.toHaveBeenCalled();
  });

  it('restores pending status if dispatch fails so the dispatcher can recover it', async () => {
    collect.mockRejectedValueOnce(new Error('Redis unavailable'));

    await expect(run({ skillDestinationSyncId: sync.id })).rejects.toThrow(
      'Redis unavailable'
    );

    expect(db.skillDestinationSync.updateMany).toHaveBeenLastCalledWith({
      where: { oid: 20n, status: 'processing', isAtRepoSyncStage: false },
      data: { status: 'pending' }
    });
  });

  it.each(['completed', 'canceled', 'failed'])('ignores a %s sync', async status => {
    db.skillDestinationSync.findUnique.mockResolvedValue({ ...sync, status });

    await run({ skillDestinationSyncId: sync.id });

    expect(collect).not.toHaveBeenCalled();
  });

  it('does not restart a sync that has reached repositories', async () => {
    db.skillDestinationSync.findUnique.mockResolvedValue({
      ...sync,
      status: 'processing',
      isAtRepoSyncStage: true
    });

    await run({ skillDestinationSyncId: sync.id });

    expect(collect).not.toHaveBeenCalled();
  });
});
