import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let {
  db,
  env,
  add,
  addManyWithOps,
  startRepositoryPropagationSync,
  getLatestRepositoryPropagation,
  hasActiveContentSync,
  recoverMissingManifestSources,
  handleSourceRecoveryLimitReached,
  getOriginSyncs
} = vi.hoisted(() => ({
  db: {
    skillRepository: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    skillDestinationSync: { findUniqueOrThrow: vi.fn() },
    skillDestinationSyncRepositoryPropagation: { findFirst: vi.fn() }
  },
  env: {
    skillSync: {
      SKILL_SYNC_MANIFEST_PROPAGATION_ENABLED: true,
      SKILL_SYNC_REPAIR_ALERT_AFTER: 24 * 3600,
      SKILL_SYNC_DRIFT_CHECK_INTERVAL: 24 * 3600
    }
  },
  add: vi.fn(),
  addManyWithOps: vi.fn(),
  startRepositoryPropagationSync: vi.fn(),
  getLatestRepositoryPropagation: vi.fn(),
  hasActiveContentSync: vi.fn(),
  recoverMissingManifestSources: vi.fn(),
  handleSourceRecoveryLimitReached: vi.fn(),
  getOriginSyncs: vi.fn()
}));

vi.mock('@metorial/db', () => ({ db }));
vi.mock('@metorial/cron', () => ({ createCron: (_: unknown, run: unknown) => run }));
vi.mock('@metorial/queue', () => ({
  createQueue: () => ({ process: (run: unknown) => run, add, addManyWithOps }),
  hourlyPacedDelay: () => ({ delay: 1 })
}));
vi.mock('../../env', () => ({ env }));
vi.mock('@metorial/skills-scm-utils', () => ({
  getOriginTenant: async () => ({ id: 'tenant_1' }),
  origin: { scmRepositorySync: { getMany: getOriginSyncs } }
}));
vi.mock('./manifest/propagate', () => ({
  getRepairDelayMs: (attempts: number) =>
    [15, 60, 240, 720][Math.min(attempts, 3)]! * 60 * 1000,
  handleSourceRecoveryLimitReached
}));
vi.mock('./manifest/recovery', () => ({
  recoverMissingManifestSources,
  isSourceRecoveryErrorCode: (code: string) =>
    ['source_not_found', 'content_mismatch'].includes(code),
  getSourceRecoveryKeys: (details?: { keys?: string[]; key?: string }) =>
    details?.keys ?? (details?.key ? [details.key] : undefined)
}));
vi.mock('./manifest/repositorySync', () => ({
  skillRepositoryDestinationInclude: {},
  startRepositoryPropagationSync,
  getLatestRepositoryPropagation,
  hasActiveContentSync
}));

import {
  skillSyncDriftCheckManyQueueProcessor,
  skillSyncDriftCheckSingleQueueProcessor,
  skillSyncRepairManyQueueProcessor,
  skillSyncRepairSingleQueueProcessor
} from './repair';

let now = new Date('2026-11-08T12:00:00Z');
let hour = 60 * 60 * 1000;

let repairMany = skillSyncRepairManyQueueProcessor as unknown as (d: {
  cursor?: string;
}) => Promise<void>;
let repairSingle = skillSyncRepairSingleQueueProcessor as unknown as (d: {
  skillRepositoryId: string;
}) => Promise<void>;
let driftMany = skillSyncDriftCheckManyQueueProcessor as unknown as (d: {
  cursor?: string;
}) => Promise<void>;
let driftSingle = skillSyncDriftCheckSingleQueueProcessor as unknown as (d: {
  skillRepositoryId: string;
}) => Promise<void>;

let destination = {
  oid: 5n,
  storageMode: 'manifest',
  currentManifestOid: 71n,
  currentManifest: { sha256: 'sha_current' }
};

let repository = (overrides: Record<string, unknown> = {}) => ({
  oid: 1n,
  id: 'repo_1',
  repoId: 'origin_repo_1',
  projectOid: 2n,
  nextRepairAt: new Date(now.getTime() - 1000),
  repairAttempts: 1,
  lastPropagatedManifestOid: 70n,
  lastDriftCheckAt: new Date(now.getTime() - hour),
  dismissedManifestSha256: null,
  marketplaceRepository: { skillMarketplace: { destination } },
  pluginRepository: null,
  ...overrides
});

let failed = (errorCode: string) => ({
  oid: 30n,
  status: 'failed',
  errorCode,
  originSyncId: 'osrs_1',
  skillDestinationSyncOid: 10n
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  env.skillSync.SKILL_SYNC_MANIFEST_PROPAGATION_ENABLED = true;
  db.skillRepository.findUnique.mockResolvedValue(repository());
  getLatestRepositoryPropagation.mockResolvedValue(failed('rate_limited'));
  hasActiveContentSync.mockResolvedValue(false);
  startRepositoryPropagationSync.mockResolvedValue({ sync: { id: 'sync_repair' } });
  db.skillDestinationSyncRepositoryPropagation.findFirst.mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('repair selection', () => {
  it('fans out repositories whose repair is due, a page at a time', async () => {
    db.skillRepository.findMany.mockResolvedValue(
      Array.from({ length: 500 }, (_, i) => ({ id: `repo_${String(i).padStart(3, '0')}` }))
    );

    await repairMany({ cursor: 'repo_000' });

    expect(db.skillRepository.findMany).toHaveBeenCalledWith({
      where: { nextRepairAt: { lte: now }, id: { gt: 'repo_000' } },
      orderBy: { id: 'asc' },
      take: 500,
      select: { id: true }
    });
    expect(addManyWithOps.mock.calls[0]![0]).toHaveLength(500);
    expect(addManyWithOps.mock.calls[0]![0][0]).toEqual({
      data: { skillRepositoryId: 'repo_000' },
      opts: { id: 'repair:repo_000' }
    });
    expect(add).toHaveBeenCalledWith({ cursor: 'repo_499' }, { delay: 1 });
  });

  it('retries a retryable failure with a repository-stage repair sync', async () => {
    await repairSingle({ skillRepositoryId: 'repo_1' });

    expect(startRepositoryPropagationSync).toHaveBeenCalledWith({
      destinationOid: 5n,
      skillRepositoryOid: 1n,
      trigger: 'repair'
    });
    expect(db.skillRepository.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { repairAttempts: { increment: 1 }, nextRepairAt: null }
    });
  });

  it('ignores repositories whose repair is not due yet', async () => {
    db.skillRepository.findUnique.mockResolvedValue(
      repository({ nextRepairAt: new Date(now.getTime() + hour) })
    );

    await repairSingle({ skillRepositoryId: 'repo_1' });

    expect(startRepositoryPropagationSync).not.toHaveBeenCalled();
    expect(db.skillRepository.update).not.toHaveBeenCalled();
  });

  it.each(['pending', 'processing', 'waiting_for_review'])(
    'leaves the repair scheduled while a propagation is %s',
    async status => {
      getLatestRepositoryPropagation.mockResolvedValue({ status });

      await repairSingle({ skillRepositoryId: 'repo_1' });

      expect(startRepositoryPropagationSync).not.toHaveBeenCalled();
      expect(db.skillRepository.update).not.toHaveBeenCalled();
    }
  );

  it('waits while a content sync for the destination is still running', async () => {
    hasActiveContentSync.mockResolvedValue(true);

    await repairSingle({ skillRepositoryId: 'repo_1' });

    expect(startRepositoryPropagationSync).not.toHaveBeenCalled();
    expect(db.skillRepository.update).not.toHaveBeenCalled();
  });

  it('waits while manifest propagation is switched off', async () => {
    env.skillSync.SKILL_SYNC_MANIFEST_PROPAGATION_ENABLED = false;

    await repairSingle({ skillRepositoryId: 'repo_1' });

    expect(startRepositoryPropagationSync).not.toHaveBeenCalled();
    expect(db.skillRepository.update).not.toHaveBeenCalled();
  });

  it.each([
    'deletion_guard_tripped',
    'manifest_invalid',
    'recovery_exhausted',
    'tree_too_large',
    'destination_too_large',
    'file_too_large',
    'lfs_quota_exceeded',
    'permission_denied',
    'origin_failed'
  ])('never repairs %s', async errorCode => {
    getLatestRepositoryPropagation.mockResolvedValue(failed(errorCode));

    await repairSingle({ skillRepositoryId: 'repo_1' });

    expect(startRepositoryPropagationSync).not.toHaveBeenCalled();
    expect(db.skillRepository.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { nextRepairAt: null }
    });
  });

  it('never repairs a dismissed pull request', async () => {
    db.skillRepository.findUnique.mockResolvedValue(
      repository({ dismissedManifestSha256: 'sha_current' })
    );
    getLatestRepositoryPropagation.mockResolvedValue({
      status: 'canceled',
      endReason: 'pull_request_closed'
    });

    await repairSingle({ skillRepositoryId: 'repo_1' });

    expect(startRepositoryPropagationSync).not.toHaveBeenCalled();
    expect(db.skillRepository.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { nextRepairAt: null }
    });
  });

  it('stops repairing once the repository already has the current manifest', async () => {
    db.skillRepository.findUnique.mockResolvedValue(
      repository({ lastPropagatedManifestOid: 71n })
    );

    await repairSingle({ skillRepositoryId: 'repo_1' });

    expect(startRepositoryPropagationSync).not.toHaveBeenCalled();
    expect(db.skillRepository.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { nextRepairAt: null, repairAttempts: 0 }
    });
  });

  it('stops repairing legacy destinations', async () => {
    db.skillRepository.findUnique.mockResolvedValue(
      repository({
        marketplaceRepository: {
          skillMarketplace: { destination: { ...destination, storageMode: 'code_bucket' } }
        }
      })
    );

    await repairSingle({ skillRepositoryId: 'repo_1' });

    expect(startRepositoryPropagationSync).not.toHaveBeenCalled();
  });

  it('rebuilds missing sources instead of resending the same manifest', async () => {
    getLatestRepositoryPropagation.mockResolvedValue(failed('source_not_found'));
    db.skillDestinationSync.findUniqueOrThrow.mockResolvedValue({
      oid: 10n,
      destinationOid: 5n
    });
    getOriginSyncs.mockResolvedValue({
      syncs: [{ id: 'osrs_1', errorDetails: { keys: ['skill-sync/blobs/sha256/gone'] } }]
    });
    recoverMissingManifestSources.mockResolvedValue({
      status: 'started',
      sync: { id: 'sync_recovery', oid: 11n }
    });

    await repairSingle({ skillRepositoryId: 'repo_1' });

    expect(getOriginSyncs).toHaveBeenCalledWith({
      tenantId: 'tenant_1',
      scmRepositorySyncIds: ['osrs_1']
    });
    expect(recoverMissingManifestSources).toHaveBeenCalledWith({
      destinationOid: 5n,
      afterSyncOid: 10n,
      keys: ['skill-sync/blobs/sha256/gone']
    });
    expect(startRepositoryPropagationSync).not.toHaveBeenCalled();
    expect(db.skillRepository.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { repairAttempts: { increment: 1 }, nextRepairAt: null }
    });
  });

  it('rebuilds everything when Origin did not record which sources were missing', async () => {
    getLatestRepositoryPropagation.mockResolvedValue({
      ...failed('source_not_found'),
      originSyncId: null
    });
    db.skillDestinationSync.findUniqueOrThrow.mockResolvedValue({
      oid: 10n,
      destinationOid: 5n
    });
    recoverMissingManifestSources.mockResolvedValue({
      status: 'started',
      sync: { id: 'sync_recovery', oid: 11n }
    });

    await repairSingle({ skillRepositoryId: 'repo_1' });

    expect(getOriginSyncs).not.toHaveBeenCalled();
    expect(recoverMissingManifestSources).toHaveBeenCalledWith({
      destinationOid: 5n,
      afterSyncOid: 10n,
      keys: undefined
    });
  });

  it('backs off when the recovery limit is still reached', async () => {
    getLatestRepositoryPropagation.mockResolvedValue(failed('source_not_found'));
    db.skillDestinationSync.findUniqueOrThrow.mockResolvedValue({
      id: 'sync_failed',
      oid: 10n,
      destinationOid: 5n
    });
    getOriginSyncs.mockResolvedValue({ syncs: [] });
    recoverMissingManifestSources.mockResolvedValue({ status: 'limit_reached' });
    handleSourceRecoveryLimitReached.mockResolvedValue(false);

    await repairSingle({ skillRepositoryId: 'repo_1' });

    expect(handleSourceRecoveryLimitReached).toHaveBeenCalledWith({
      skillDestinationSyncId: 'sync_failed',
      propagation: failed('source_not_found'),
      skillRepositoryOid: 1n,
      keys: undefined
    });
    expect(db.skillRepository.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: {
        repairAttempts: { increment: 1 },
        nextRepairAt: new Date(now.getTime() + 4 * hour)
      }
    });
  });

  it('stops repairing once source recovery is exhausted', async () => {
    getLatestRepositoryPropagation.mockResolvedValue(failed('source_not_found'));
    db.skillDestinationSync.findUniqueOrThrow.mockResolvedValue({
      id: 'sync_failed',
      oid: 10n,
      destinationOid: 5n
    });
    getOriginSyncs.mockResolvedValue({ syncs: [] });
    recoverMissingManifestSources.mockResolvedValue({ status: 'limit_reached' });
    handleSourceRecoveryLimitReached.mockResolvedValue(true);

    await repairSingle({ skillRepositoryId: 'repo_1' });

    expect(db.skillRepository.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { repairAttempts: { increment: 1 }, nextRepairAt: null }
    });
  });

  it('rebuilds the source Origin found with mismatched content', async () => {
    getLatestRepositoryPropagation.mockResolvedValue(failed('content_mismatch'));
    db.skillDestinationSync.findUniqueOrThrow.mockResolvedValue({
      id: 'sync_failed',
      oid: 10n,
      destinationOid: 5n
    });
    getOriginSyncs.mockResolvedValue({
      syncs: [
        { id: 'osrs_1', errorDetails: { key: 'skill-sync/blobs/sha256/bad', path: 'a.md' } }
      ]
    });
    recoverMissingManifestSources.mockResolvedValue({
      status: 'started',
      sync: { id: 'sync_recovery', oid: 11n }
    });

    await repairSingle({ skillRepositoryId: 'repo_1' });

    expect(recoverMissingManifestSources).toHaveBeenCalledWith({
      destinationOid: 5n,
      afterSyncOid: 10n,
      keys: ['skill-sync/blobs/sha256/bad']
    });
    expect(startRepositoryPropagationSync).not.toHaveBeenCalled();
  });

  it('raises an alert once a repository has been failing for a day', async () => {
    let error = vi.spyOn(console, 'error').mockImplementation(() => {});
    db.skillDestinationSyncRepositoryPropagation.findFirst
      .mockResolvedValueOnce({ oid: 20n })
      .mockResolvedValueOnce({ completedAt: new Date(now.getTime() - 25 * hour) });

    await repairSingle({ skillRepositoryId: 'repo_1' });

    expect(db.skillDestinationSyncRepositoryPropagation.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { skillRepositoryOid: 1n, status: 'failed', oid: { gt: 20n } }
      })
    );
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('cargo_skill_repository_repair_failing')
    );
    expect(startRepositoryPropagationSync).toHaveBeenCalled();
    error.mockRestore();
  });

  it('does not alert for a repository that only started failing recently', async () => {
    let error = vi.spyOn(console, 'error').mockImplementation(() => {});
    db.skillDestinationSyncRepositoryPropagation.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ completedAt: new Date(now.getTime() - 2 * hour) });

    await repairSingle({ skillRepositoryId: 'repo_1' });

    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('drift checks', () => {
  let unchanged = (overrides: Record<string, unknown> = {}) =>
    repository({
      lastPropagatedManifestOid: 71n,
      lastDriftCheckAt: new Date(now.getTime() - 25 * hour),
      ...overrides
    });

  beforeEach(() => {
    db.skillRepository.findUnique.mockResolvedValue(unchanged());
    getLatestRepositoryPropagation.mockResolvedValue({ status: 'completed' });
  });

  it('selects repositories whose last drift check is stale', async () => {
    db.skillRepository.findMany.mockResolvedValue([{ id: 'repo_1' }]);

    await driftMany({});

    expect(db.skillRepository.findMany).toHaveBeenCalledWith({
      where: {
        lastPropagatedManifestOid: { not: null },
        lastDriftCheckAt: { lt: new Date(now.getTime() - 24 * hour) },
        id: undefined
      },
      orderBy: { id: 'asc' },
      take: 500,
      select: { id: true }
    });
    expect(addManyWithOps).toHaveBeenCalledWith([
      { data: { skillRepositoryId: 'repo_1' }, opts: { id: 'drift:repo_1' } }
    ]);
  });

  it('does not select anything while propagation is switched off', async () => {
    env.skillSync.SKILL_SYNC_MANIFEST_PROPAGATION_ENABLED = false;

    await driftMany({});

    expect(db.skillRepository.findMany).not.toHaveBeenCalled();
  });

  it('re-sends the current manifest to an unchanged repository once a day', async () => {
    await driftSingle({ skillRepositoryId: 'repo_1' });

    expect(startRepositoryPropagationSync).toHaveBeenCalledWith({
      destinationOid: 5n,
      skillRepositoryOid: 1n,
      trigger: 'drift_check'
    });
  });

  it.each([
    ['the drift check is still fresh', { lastDriftCheckAt: new Date(now.getTime() - hour) }],
    ['the repository is behind the current manifest', { lastPropagatedManifestOid: 70n }],
    ['the content was dismissed', { dismissedManifestSha256: 'sha_current' }]
  ])('skips when %s', async (_, overrides) => {
    db.skillRepository.findUnique.mockResolvedValue(unchanged(overrides));

    await driftSingle({ skillRepositoryId: 'repo_1' });

    expect(startRepositoryPropagationSync).not.toHaveBeenCalled();
  });

  it.each(['pending', 'processing', 'waiting_for_review', 'failed'])(
    'skips while the latest propagation is %s',
    async status => {
      getLatestRepositoryPropagation.mockResolvedValue({ status });

      await driftSingle({ skillRepositoryId: 'repo_1' });

      expect(startRepositoryPropagationSync).not.toHaveBeenCalled();
    }
  );
});
