import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, bucket, next } = vi.hoisted(() => ({
  db: {
    skillDestinationSync: { findUnique: vi.fn(), update: vi.fn() },
    skillDestinationItem: { findMany: vi.fn(), findFirst: vi.fn() }
  },
  bucket: { deleteBucketFile: vi.fn() },
  next: vi.fn()
}));

vi.mock('@metorial/db', () => ({ db }));
vi.mock('@metorial/queue', () => ({
  createQueue: () => ({ process: (run: unknown) => run, add: next })
}));
vi.mock('@mtsrc/scm-code-bucket-client-internal', () => ({
  createCodeBucketClient: () => bucket
}));
vi.mock('../../lib/limits', () => ({ CargoSkillLimitError: class extends Error {} }));
vi.mock('@metorial/module-file', () => ({ fileService: {} }));
vi.mock('../../env', () => ({ env: { origin: { CODE_BUCKET_SERVICE_URL: 'unused' } } }));
vi.mock('../../serializers/marketplace', () => ({ applyMarketplace: {} }));
vi.mock('../../serializers/plugin', () => ({ applyPlugin: {}, getPluginPath: vi.fn() }));
vi.mock('../../serializers/skill', () => ({ applySkill: {}, getSkillPath: vi.fn() }));
vi.mock('../../lib/securityReviewPolicy', () => ({
  getWithheldSkillIds: async () => new Set<string>()
}));
vi.mock('./_lib/bucket', () => ({ destinationBucketIsAvailable: async () => true }));
vi.mock('./_lib/lock', () => ({ withDestinationSyncLock: (run: unknown) => run }));
vi.mock('./_lib/logs', () => ({ appendSkillDestinationSyncLog: vi.fn() }));
vi.mock('./reconcile', () => ({ syncReconcileQueue: { add: next } }));

import { syncCollectQueueProcessor } from './collect';
import { syncProcessQueueProcessor } from './process';

let process = syncProcessQueueProcessor as unknown as (data: {
  skillDestinationSyncId: string;
  contentVersion?: number;
  tasks: unknown[];
}) => Promise<void>;
let collect = syncCollectQueueProcessor as unknown as (data: {
  skillDestinationSyncId: string;
}) => Promise<void>;

describe('content recovery fencing', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.skillDestinationSync.findUnique.mockResolvedValue({
      status: 'processing',
      contentVersion: 2
    });
  });

  it.each([undefined, 0, 1])(
    'ignores a stale destructive task from version %s',
    async contentVersion => {
      await process({
        skillDestinationSyncId: 'sync',
        contentVersion,
        tasks: [{ type: 'plugin', action: 'delete', skillPluginId: 'reintroduced-plugin' }]
      });

      expect(db.skillDestinationItem.findFirst).not.toHaveBeenCalled();
      expect(bucket.deleteBucketFile).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    }
  );

  it('accepts queued pre-deployment work while its persisted version is still zero', async () => {
    db.skillDestinationSync.findUnique.mockResolvedValue({
      status: 'processing',
      contentVersion: 0,
      destination: { storageMode: 'code_bucket' }
    });

    await process({ skillDestinationSyncId: 'sync', tasks: [] });

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ skillDestinationSyncId: 'sync', contentVersion: 0 })
    );
  });

  it('prevents an old collector from restarting content after repository handoff', async () => {
    db.skillDestinationSync.findUnique.mockResolvedValue({
      status: 'processing',
      contentVersion: 2,
      isAtRepoSyncStage: true
    });

    await collect({ skillDestinationSyncId: 'sync' });

    expect(db.skillDestinationSync.update).not.toHaveBeenCalled();
    expect(db.skillDestinationItem.findMany).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
