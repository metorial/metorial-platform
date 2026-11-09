import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, processTask, processQueue, reconcile, available, log, LimitError } = vi.hoisted(
  () => ({
    db: {
      skillDestinationSync: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
      skillDestinationItem: { findMany: vi.fn() }
    },
    processTask: vi.fn(),
    processQueue: vi.fn(),
    reconcile: vi.fn(),
    available: vi.fn(),
    log: vi.fn(),
    LimitError: class CargoSkillLimitError extends Error {}
  })
);

vi.mock('@metorial/db', () => ({ db, withTransaction: vi.fn() }));
vi.mock('@metorial/queue', () => ({
  createQueue: () => ({ process: (run: unknown) => run, add: processQueue })
}));
vi.mock('@metorial/code-bucket-service-generated', () => ({
  createCodeBucketClient: () => ({})
}));
vi.mock('@metorial/module-file', () => ({ fileService: {} }));
vi.mock('../../env', () => ({ env: { origin: { CODE_BUCKET_SERVICE_URL: 'unused' } } }));
vi.mock('../../lib/limits', () => ({ CargoSkillLimitError: LimitError }));
vi.mock('../../serializers/marketplace', () => ({ applyMarketplace: {} }));
vi.mock('../../serializers/plugin', () => ({ applyPlugin: {}, getPluginPath: vi.fn() }));
vi.mock('../../serializers/skill', () => ({ applySkill: {}, getSkillPath: vi.fn() }));
vi.mock('./_lib/bucket', () => ({ destinationBucketIsAvailable: available }));
vi.mock('./_lib/lock', () => ({ withDestinationSyncLock: (run: unknown) => run }));
vi.mock('./_lib/logs', () => ({ appendSkillDestinationSyncLog: log }));
vi.mock('./_lib/manifestTask', () => ({ processManifestSyncTask: processTask }));
vi.mock('./reconcile', () => ({ syncReconcileQueue: { add: reconcile } }));

import { syncProcessQueueProcessor } from './process';

let run = syncProcessQueueProcessor as unknown as (data: {
  skillDestinationSyncId: string;
  contentVersion?: number;
  tasks: unknown[];
  hasChanges?: boolean;
  hashWaits?: number;
}) => Promise<void>;

let tasks = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    type: 'skill',
    action: 'set',
    skillPluginId: 'p',
    skillId: `s${i}`
  }));

describe('manifest process stage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.skillDestinationSync.findUnique.mockResolvedValue({
      oid: 7n,
      status: 'processing',
      contentVersion: 1,
      destinationOid: 1n,
      destination: { oid: 1n, storageMode: 'manifest' }
    });
    db.skillDestinationSync.update.mockResolvedValue({ contentVersion: 2 });
    db.skillDestinationItem.findMany.mockResolvedValue([
      { skill: { id: 's0' }, skillPlugin: { id: 'p' }, skillMarketplace: null }
    ]);
    processTask.mockResolvedValue({ type: 'changed' });
  });

  it('processes at most 25 tasks per job and re-enqueues the rest', async () => {
    await run({ skillDestinationSyncId: 'sync_1', contentVersion: 1, tasks: tasks(30) });

    expect(processTask).toHaveBeenCalledTimes(25);
    expect(processTask.mock.calls[0]![0].liveItemKeys).toEqual(new Set(['skill:s0:p']));
    expect(processQueue).toHaveBeenCalledWith(
      {
        skillDestinationSyncId: 'sync_1',
        contentVersion: 2,
        hasChanges: true,
        skillRepositoryId: undefined,
        tasks: tasks(30).slice(25),
        hashWaits: undefined
      },
      undefined
    );
    expect(reconcile).not.toHaveBeenCalled();
    expect(available).not.toHaveBeenCalled();
  });

  it('hands off to reconcile once every task is done', async () => {
    processTask.mockResolvedValue({ type: 'skipped' });

    await run({ skillDestinationSyncId: 'sync_1', contentVersion: 1, tasks: tasks(3) });

    expect(reconcile).toHaveBeenCalledWith({
      skillDestinationSyncId: 'sync_1',
      contentVersion: 2,
      hasChanges: false,
      skillRepositoryId: undefined
    });
  });

  it('stops early when the time budget is used up', async () => {
    let now = 0;
    let spy = vi.spyOn(Date, 'now').mockImplementation(() => now);
    processTask.mockImplementation(async () => {
      now += 7_000;
      return { type: 'changed' };
    });

    await run({ skillDestinationSyncId: 'sync_1', contentVersion: 1, tasks: tasks(10) });
    spy.mockRestore();

    expect(processTask).toHaveBeenCalledTimes(3);
    expect(processQueue.mock.calls[0]![0].tasks).toHaveLength(7);
  });

  it('waits for large-file hashes by re-enqueueing the same task with a delay', async () => {
    processTask
      .mockResolvedValueOnce({ type: 'changed' })
      .mockResolvedValueOnce({ type: 'deferred', fileCount: 2 });

    await run({ skillDestinationSyncId: 'sync_1', contentVersion: 1, tasks: tasks(3) });

    expect(processQueue).toHaveBeenCalledWith(
      expect.objectContaining({ tasks: tasks(3).slice(1), hashWaits: 1, hasChanges: true }),
      { delay: 30_000 }
    );
    expect(log).toHaveBeenCalledWith('sync_1', 'Waiting for 2 large files to be hashed.');

    log.mockClear();
    processQueue.mockClear();
    processTask.mockResolvedValueOnce({ type: 'deferred', fileCount: 2 });

    await run({
      skillDestinationSyncId: 'sync_1',
      contentVersion: 1,
      tasks: tasks(2),
      hashWaits: 1
    });

    expect(processQueue).toHaveBeenCalledWith(expect.objectContaining({ hashWaits: 2 }), {
      delay: 30_000
    });
    expect(log).not.toHaveBeenCalled();
  });

  it('gives up after waiting too long for hashes', async () => {
    processTask.mockResolvedValue({ type: 'deferred', fileCount: 1 });

    await run({
      skillDestinationSyncId: 'sync_1',
      contentVersion: 1,
      tasks: tasks(1),
      hashWaits: 240
    });

    expect(db.skillDestinationSync.updateMany).toHaveBeenCalledWith({
      where: { id: 'sync_1', status: 'processing' },
      data: { status: 'failed', completedAt: expect.any(Date) }
    });
    expect(processQueue).not.toHaveBeenCalled();
  });

  it('fails the sync on a limit error', async () => {
    processTask.mockRejectedValue(new LimitError('File too big'));

    await run({ skillDestinationSyncId: 'sync_1', contentVersion: 1, tasks: tasks(2) });

    expect(log).toHaveBeenCalledWith('sync_1', 'File too big');
    expect(db.skillDestinationSync.updateMany).toHaveBeenCalled();
    expect(processQueue).not.toHaveBeenCalled();
    expect(reconcile).not.toHaveBeenCalled();
  });

  it('rethrows other errors so the job retries', async () => {
    processTask.mockRejectedValue(new Error('db down'));

    await expect(
      run({ skillDestinationSyncId: 'sync_1', contentVersion: 1, tasks: tasks(2) })
    ).rejects.toThrow('db down');
  });
});
