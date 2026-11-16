import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db } = vi.hoisted(() => ({
  db: {
    skillDestinationSync: { findUnique: vi.fn(), updateMany: vi.fn() },
    skillDestinationSyncRepositoryPropagation: { findMany: vi.fn() }
  }
}));

vi.mock('@metorial/db', () => ({ db }));
vi.mock('@metorial/queue', () => ({
  createQueue: () => ({ process: (run: unknown) => run })
}));
vi.mock('./_lib/lock', () => ({ withDestinationSyncLock: (run: unknown) => run }));
vi.mock('./_lib/logs', () => ({ appendSkillDestinationSyncLog: vi.fn() }));

import { syncFinishQueueProcessor } from './finish';

let run = syncFinishQueueProcessor as unknown as (data: {
  skillDestinationSyncId: string;
  status?: 'completed' | 'canceled';
}) => Promise<void>;

describe('durable sync completion', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.skillDestinationSync.findUnique.mockResolvedValue({
      oid: 1n,
      status: 'processing',
      isAtRepoSyncStage: true
    });
    db.skillDestinationSync.updateMany.mockResolvedValue({ count: 1 });
  });

  it.each(['pending', 'processing', 'waiting_for_review', 'failed'])(
    'rejects stale completion when any repository remains %s',
    async status => {
      db.skillDestinationSyncRepositoryPropagation.findMany.mockResolvedValue([
        { status: 'completed' },
        { status }
      ]);

      await run({ skillDestinationSyncId: 'sync', status: 'completed' });

      expect(db.skillDestinationSync.updateMany).not.toHaveBeenCalled();
    }
  );

  it('derives cancellation from durable repository state rather than an old payload', async () => {
    db.skillDestinationSyncRepositoryPropagation.findMany.mockResolvedValue([
      { status: 'canceled' }
    ]);

    await run({ skillDestinationSyncId: 'sync', status: 'completed' });

    expect(db.skillDestinationSync.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'canceled', completedAt: expect.any(Date) }
      })
    );
  });

  it('finishes a frozen empty fanout', async () => {
    db.skillDestinationSyncRepositoryPropagation.findMany.mockResolvedValue([]);

    await run({ skillDestinationSyncId: 'sync' });

    expect(db.skillDestinationSync.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'completed', completedAt: expect.any(Date) }
      })
    );
  });

  it('cannot finish before repository fanout commits', async () => {
    db.skillDestinationSync.findUnique.mockResolvedValue({
      status: 'processing',
      isAtRepoSyncStage: false
    });

    await run({ skillDestinationSyncId: 'sync' });

    expect(db.skillDestinationSync.updateMany).not.toHaveBeenCalled();
  });
});
