import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, propagate } = vi.hoisted(() => ({
  db: {
    skillDestinationSync: { findUnique: vi.fn() },
    skillDestinationItem: { findMany: vi.fn() },
    skillDestinationFile: { findMany: vi.fn() }
  },
  propagate: vi.fn()
}));

vi.mock('@metorial/db', () => ({ db }));
vi.mock('@metorial/queue', () => ({
  createQueue: () => ({ process: (run: unknown) => run })
}));
vi.mock('@metorial/code-bucket-service-generated', () => ({
  createCodeBucketClient: () => ({})
}));
vi.mock('../../env', () => ({
  env: { origin: { CODE_BUCKET_SERVICE_URL: 'http://unused' } }
}));
vi.mock('./_lib/bucket', () => ({ destinationBucketIsAvailable: async () => true }));
vi.mock('./_lib/lock', () => ({ withDestinationSyncLock: (run: unknown) => run }));
vi.mock('./_lib/logs', () => ({ appendSkillDestinationSyncLog: vi.fn() }));
vi.mock('./propagate', () => ({ syncPropagateStartQueue: { add: propagate } }));

import { syncReconcileQueueProcessor } from './reconcile';

let run = syncReconcileQueueProcessor as unknown as (data: {
  skillDestinationSyncId: string;
  hasChanges: boolean;
}) => Promise<void>;

describe('repository reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.skillDestinationSync.findUnique.mockResolvedValue({
      status: 'processing',
      contentVersion: 0,
      destinationOid: 1n
    });
    db.skillDestinationItem.findMany.mockResolvedValue([]);
    db.skillDestinationFile.findMany.mockResolvedValue([]);
  });

  it('propagates unchanged content for repository initialization, policy updates, and retried writes', async () => {
    await run({ skillDestinationSyncId: 'sync_1', hasChanges: false });

    expect(propagate).toHaveBeenCalledWith({
      skillDestinationSyncId: 'sync_1',
      contentVersion: 0,
      skillRepositoryId: undefined
    });
  });

  it.each([
    { status: 'processing', contentVersion: 2 },
    { status: 'processing', contentVersion: 0, isAtRepoSyncStage: true }
  ])('ignores a stale handoff or completed content stage: %j', async sync => {
    db.skillDestinationSync.findUnique.mockResolvedValue(sync);

    await run({ skillDestinationSyncId: 'sync_1', hasChanges: false });

    expect(db.skillDestinationFile.findMany).not.toHaveBeenCalled();
    expect(propagate).not.toHaveBeenCalled();
  });

  it('ignores a sync superseded while waiting for its lock', async () => {
    db.skillDestinationSync.findUnique.mockResolvedValue({ status: 'canceled' });

    await run({ skillDestinationSyncId: 'sync_1', hasChanges: false });

    expect(propagate).not.toHaveBeenCalled();
  });
});
