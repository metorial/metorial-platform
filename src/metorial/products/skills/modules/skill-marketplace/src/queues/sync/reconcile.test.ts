import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, propagate, snapshot, unchangedSync, deletions } = vi.hoisted(() => ({
  db: {
    skillDestinationSync: { findUnique: vi.fn() },
    skillDestinationItem: { findMany: vi.fn() },
    skillDestinationFile: { findMany: vi.fn(), deleteMany: vi.fn() }
  },
  propagate: vi.fn(),
  snapshot: vi.fn(),
  unchangedSync: {
    canSkipUnchangedSync: vi.fn(),
    areCodeBucketRepositoriesCurrent: vi.fn(),
    finishUnchangedSync: vi.fn(),
    incrementDestinationContentRevision: vi.fn()
  },
  deletions: { recordDestinationFileDeletions: vi.fn() }
}));

vi.mock('@metorial/db', () => ({ db }));
vi.mock('@metorial/queue', async () => ({
  createQueue: () => ({ process: (run: unknown) => run }),
  deleteInChunks: (
    await import('../../../../../../../../lowerdeck/packages/queue/src/lib/deleteInChunks')
  ).deleteInChunks
}));
vi.mock('@metorial/code-bucket-service-generated', () => ({
  createCodeBucketClient: () => ({ deleteBucketFile: vi.fn() })
}));
vi.mock('@metorial/skills-scm-utils', () => ({
  getSkillDestinationCodeBucketId: () => 'bucket_1'
}));
vi.mock('./_lib/unchangedSync', () => unchangedSync);
vi.mock('./_lib/deletions', () => deletions);
vi.mock('../../env', () => ({
  env: { origin: { CODE_BUCKET_SERVICE_URL: 'http://unused' } }
}));
vi.mock('./_lib/bucket', () => ({ destinationBucketIsAvailable: async () => true }));
vi.mock('./_lib/lock', () => ({ withDestinationSyncLock: (run: unknown) => run }));
vi.mock('./_lib/logs', () => ({ appendSkillDestinationSyncLog: vi.fn() }));
vi.mock('./propagate', () => ({ syncPropagateStartQueue: { add: propagate } }));
vi.mock('./snapshot', () => ({ syncSnapshotQueue: { add: snapshot } }));

import { syncReconcileQueueProcessor } from './reconcile';

let run = syncReconcileQueueProcessor as unknown as (data: {
  skillDestinationSyncId: string;
  hasChanges: boolean;
}) => Promise<void>;

describe('repository reconciliation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.skillDestinationSync.findUnique.mockResolvedValue({
      oid: 7n,
      status: 'processing',
      contentVersion: 0,
      destinationOid: 1n,
      destination: { storageMode: 'code_bucket' }
    });
    db.skillDestinationItem.findMany.mockResolvedValue([]);
    db.skillDestinationFile.findMany.mockResolvedValue([]);
  });

  it('propagates unchanged content when a repository has not received the current revision', async () => {
    unchangedSync.canSkipUnchangedSync.mockReturnValue(true);
    unchangedSync.areCodeBucketRepositoriesCurrent.mockResolvedValue(false);

    await run({ skillDestinationSyncId: 'sync_1', hasChanges: false });

    expect(unchangedSync.areCodeBucketRepositoriesCurrent).toHaveBeenCalledWith(1n);
    expect(propagate).toHaveBeenCalledWith({
      skillDestinationSyncId: 'sync_1',
      contentVersion: 0,
      skillRepositoryId: undefined
    });
    expect(unchangedSync.finishUnchangedSync).not.toHaveBeenCalled();
    expect(snapshot).not.toHaveBeenCalled();
  });

  it('finishes an unchanged sync without repository updates when every repository is current', async () => {
    unchangedSync.canSkipUnchangedSync.mockReturnValue(true);
    unchangedSync.areCodeBucketRepositoriesCurrent.mockResolvedValue(true);

    await run({ skillDestinationSyncId: 'sync_1', hasChanges: false });

    expect(unchangedSync.finishUnchangedSync).toHaveBeenCalledWith({
      syncOid: 7n,
      skillDestinationSyncId: 'sync_1'
    });
    expect(propagate).not.toHaveBeenCalled();
  });

  it('propagates syncs that may not be skipped without checking repositories', async () => {
    unchangedSync.canSkipUnchangedSync.mockReturnValue(false);

    await run({ skillDestinationSyncId: 'sync_1', hasChanges: true });

    expect(unchangedSync.canSkipUnchangedSync).toHaveBeenCalledWith(
      expect.objectContaining({ hasChanges: true })
    );
    expect(unchangedSync.areCodeBucketRepositoriesCurrent).not.toHaveBeenCalled();
    expect(propagate).toHaveBeenCalledOnce();
  });

  it('bumps the content revision and propagates when orphaned files are removed', async () => {
    unchangedSync.canSkipUnchangedSync.mockImplementation(d => !d.hasChanges);
    db.skillDestinationFile.findMany.mockResolvedValue([
      { path: 'old.md', itemKey: 'skill:gone' }
    ]);

    await run({ skillDestinationSyncId: 'sync_1', hasChanges: false });

    expect(deletions.recordDestinationFileDeletions).toHaveBeenCalledWith({
      destinationOid: 1n,
      paths: ['old.md']
    });
    expect(unchangedSync.incrementDestinationContentRevision).toHaveBeenCalledWith(1n);
    expect(unchangedSync.canSkipUnchangedSync).toHaveBeenCalledWith(
      expect.objectContaining({ hasChanges: true })
    );
    expect(propagate).toHaveBeenCalledOnce();
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

describe('manifest reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.skillDestinationSync.findUnique.mockResolvedValue({
      status: 'processing',
      contentVersion: 3,
      destinationOid: 1n,
      destination: { storageMode: 'manifest' }
    });
    db.skillDestinationItem.findMany.mockResolvedValue([
      { skillMarketplace: { id: 'mkt_1' }, skillPlugin: null, skill: null }
    ]);
  });

  it('deletes rows of items that are gone and hands off to the snapshot stage', async () => {
    db.skillDestinationFile.findMany
      .mockResolvedValueOnce([{ oid: 10n }, { oid: 11n }])
      .mockResolvedValueOnce([]);

    await (run as any)({
      skillDestinationSyncId: 'sync_1',
      hasChanges: false,
      contentVersion: 3
    });

    expect(db.skillDestinationFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          destinationOid: 1n,
          OR: [{ itemKey: null }, { itemKey: { notIn: ['marketplace:mkt_1'] } }]
        }
      })
    );
    expect(db.skillDestinationFile.deleteMany).toHaveBeenCalledWith({
      where: { oid: { in: [10n, 11n] } }
    });
    expect(snapshot).toHaveBeenCalledWith({
      skillDestinationSyncId: 'sync_1',
      contentVersion: 3,
      hasChanges: true,
      skillRepositoryId: undefined
    });
    expect(propagate).not.toHaveBeenCalled();
  });

  it('keeps hasChanges from the process stage when nothing is orphaned', async () => {
    db.skillDestinationFile.findMany.mockResolvedValueOnce([]);

    await (run as any)({
      skillDestinationSyncId: 'sync_1',
      hasChanges: true,
      contentVersion: 3
    });

    expect(db.skillDestinationFile.deleteMany).not.toHaveBeenCalled();
    expect(snapshot).toHaveBeenCalledWith(expect.objectContaining({ hasChanges: true }));
  });
});
