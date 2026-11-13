import { badRequestError, conflictError, ServiceError } from '@lowerdeck/error';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let {
  db,
  env,
  syncManifest,
  recoverMissingManifestSources,
  recordSourceRecoveryLimitReached,
  appendLog,
  report
} = vi.hoisted(() => ({
  db: {
    skillDestinationManifest: { findUnique: vi.fn() },
    skillRepository: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    skillDestinationSyncRepositoryPropagation: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    }
  },
  env: {
    skillSync: {
      SKILL_SYNC_MANIFEST_PROPAGATION_ENABLED: true,
      SKILL_SYNC_DELETION_GUARD_MAX_UNEXPECTED_DELETES: 250,
      SKILL_SYNC_DELETION_GUARD_MAX_UNEXPECTED_DELETE_RATIO: 0.1,
      SKILL_SYNC_DRIFT_CHECK_INTERVAL: 24 * 3600,
      SKILL_SYNC_MAX_SYNC_LIFETIME: 2 * 24 * 3600,
      SKILL_SYNC_REPAIR_BACKOFF: [900, 3600, 14400, 43200]
    }
  },
  syncManifest: vi.fn(),
  recoverMissingManifestSources: vi.fn(),
  recordSourceRecoveryLimitReached: vi.fn(),
  appendLog: vi.fn(),
  report: vi.fn()
}));

vi.mock('@metorial/db', () => ({ db }));
vi.mock('@metorial/module-file', () => ({ getCargoFilesBucketName: () => 'cargo-files' }));
vi.mock('@metorial/skills-scm-utils', () => ({
  origin: { scmRepository: { syncManifest } },
  getOriginTenant: async () => ({ id: 'tenant_1' })
}));
vi.mock('../../../env', () => ({ env }));
vi.mock('../_lib/logs', () => ({ appendSkillDestinationSyncLog: appendLog }));
vi.mock('../_lib/report', () => ({ reportSkillSyncIssue: report }));
vi.mock('./recovery', () => ({
  recoverMissingManifestSources,
  recordSourceRecoveryLimitReached,
  isSourceRecoveryErrorCode: (code: string) =>
    ['source_not_found', 'content_mismatch'].includes(code),
  getSourceRecoveryKeys: (details?: { keys?: string[]; key?: string }) =>
    details?.keys ?? (details?.key ? [details.key] : undefined)
}));

import {
  getRepairDelayMs,
  performManifestPropagation,
  reconcileManifestPropagation,
  shouldSkipManifestPropagation
} from './propagate';

let now = new Date('2026-11-08T12:00:00Z');
let minute = 60 * 1000;
let hour = 60 * minute;

let sync = {
  oid: 10n,
  id: 'sync_1',
  destinationOid: 5n,
  trigger: 'automatic',
  allowMassDelete: false,
  destination: { id: 'destination_1' }
} as any;

let propagation = (overrides: Record<string, unknown> = {}) =>
  ({
    oid: 3n,
    id: 'propagation_1',
    status: 'pending',
    originSyncId: null,
    startedAt: null,
    manifestOid: 70n,
    previousManifestSha256: null,
    repositoryAccessMode: 'pull_request',
    forceMergeOrPush: false,
    mergeBeforeChecksPass: false,
    branchName: 'metorial/sync-marketplace-1-abcd',
    prName: 'Sync marketplace',
    prDescription: null,
    commitMessage: 'Sync marketplace',
    waitingReason: null,
    waitingUntil: null,
    errorMessage: null,
    skillRepositoryOid: 1n,
    skillRepository: {
      oid: 1n,
      repoId: 'repo_1',
      repairAttempts: 0,
      project: { skillSyncGitLfsThresholdBytes: null }
    },
    ...overrides
  }) as any;

let manifest = { oid: 70n, sha256: 'sha_new', objectKey: 'manifests/new', entryCount: 12 };

let repository = (overrides: Record<string, unknown> = {}) => ({
  oid: 1n,
  lastDriftCheckAt: new Date(now.getTime() - hour),
  dismissedManifestSha256: null,
  lastPropagatedManifest: { sha256: 'sha_old' },
  ...overrides
});

let perform = (overrides: Record<string, unknown> = {}, syncOverrides = {}) =>
  performManifestPropagation({
    skillDestinationSyncId: 'sync_1',
    sync: { ...sync, ...syncOverrides },
    propagation: propagation(overrides),
    getRepositoryName: async () => 'acme/skills'
  });

let reconcile = (
  originSync: Record<string, unknown>,
  overrides: Record<string, unknown> = {}
) =>
  reconcileManifestPropagation({
    skillDestinationSyncId: 'sync_1',
    sync,
    propagation: propagation({
      status: 'processing',
      originSyncId: 'origin_1',
      startedAt: new Date(now.getTime() - hour),
      ...overrides
    }),
    originSync: { id: 'origin_1', ...originSync } as any,
    repositoryName: 'acme/skills',
    formatWaitingForReviewMessage: () => 'Waiting for review.'
  });

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  env.skillSync.SKILL_SYNC_MANIFEST_PROPAGATION_ENABLED = true;
  db.skillDestinationManifest.findUnique.mockResolvedValue(manifest);
  db.skillRepository.findUniqueOrThrow.mockResolvedValue(repository());
  db.skillDestinationSyncRepositoryPropagation.findFirst.mockResolvedValue({
    status: 'completed'
  });
  db.skillDestinationSyncRepositoryPropagation.updateMany.mockResolvedValue({ count: 1 });
  syncManifest.mockResolvedValue({
    id: 'origin_1',
    status: 'syncing_contents',
    branchName: 'metorial/sync-marketplace-1-abcd'
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('repair backoff', () => {
  it.each([
    [0, 15 * minute],
    [1, hour],
    [2, 4 * hour],
    [3, 12 * hour],
    [9, 12 * hour]
  ])('waits after %s attempts: %s ms', (attempts, delay) => {
    expect(getRepairDelayMs(attempts)).toBe(delay);
  });
});

describe('unchanged repository skip', () => {
  let skip = (d: {
    trigger?: string;
    manifestSha256?: string;
    repository?: Record<string, unknown>;
    previousPropagationStatus?: string | null;
  }) =>
    shouldSkipManifestPropagation({
      trigger: (d.trigger ?? 'automatic') as any,
      manifestSha256: d.manifestSha256 ?? 'sha_old',
      repository: repository(d.repository) as any,
      previousPropagationStatus:
        d.previousPropagationStatus === undefined ? 'completed' : d.previousPropagationStatus,
      now,
      driftCheckIntervalMs: 24 * hour
    });

  it('skips a repository that already has this manifest and was checked recently', () => {
    expect(skip({})).toBe('unchanged');
  });

  it('sends a changed manifest', () => {
    expect(skip({ manifestSha256: 'sha_new' })).toBeNull();
  });

  it('sends when the last drift check is stale', () => {
    expect(
      skip({ repository: { lastDriftCheckAt: new Date(now.getTime() - 25 * hour) } })
    ).toBeNull();
    expect(skip({ repository: { lastDriftCheckAt: null } })).toBeNull();
  });

  it('sends when the previous propagation did not complete', () => {
    expect(skip({ previousPropagationStatus: 'failed' })).toBeNull();
    expect(skip({ previousPropagationStatus: null })).toBeNull();
  });

  it('always sends drift checks and manual syncs', () => {
    expect(skip({ trigger: 'drift_check' })).toBeNull();
    expect(skip({ trigger: 'manual' })).toBeNull();
  });

  it('skips content whose pull request was dismissed unless the sync is manual', () => {
    let dismissed = { dismissedManifestSha256: 'sha_new' };

    expect(skip({ manifestSha256: 'sha_new', repository: dismissed })).toBe('dismissed');
    expect(skip({ manifestSha256: 'sha_new', repository: dismissed, trigger: 'repair' })).toBe(
      'dismissed'
    );
    expect(
      skip({ manifestSha256: 'sha_new', repository: dismissed, trigger: 'manual' })
    ).toBeNull();
  });
});

describe('sending a manifest to Origin', () => {
  it('sends the manifest, the last manifest for that repository and the deletion guard', async () => {
    db.skillDestinationManifest.findUnique
      .mockResolvedValueOnce(manifest)
      .mockResolvedValueOnce({ sha256: 'sha_old', objectKey: 'manifests/old' });

    let result = await perform({ previousManifestSha256: 'sha_old' });

    expect(result).toBe('sent');
    expect(syncManifest).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant_1',
        scmRepositoryId: 'repo_1',
        requestKey: 'propagation_1',
        sourceKey: 'destination_1',
        manifest: {
          bucket: 'cargo-files',
          key: 'manifests/new',
          sha256: 'sha_new',
          entryCount: 12
        },
        previousManifest: { bucket: 'cargo-files', key: 'manifests/old', sha256: 'sha_old' },
        deletionGuard: { maxUnexpectedDeletes: 250, maxUnexpectedDeleteRatio: 0.1 },
        allowMassDelete: false,
        branchName: 'metorial/sync-marketplace-1-abcd',
        enableAutoMerge: true
      })
    );
    expect(db.skillDestinationManifest.findUnique).toHaveBeenLastCalledWith({
      where: { destinationOid_sha256: { destinationOid: 5n, sha256: 'sha_old' } }
    });
    expect(db.skillDestinationSyncRepositoryPropagation.update).toHaveBeenLastCalledWith({
      where: { oid: 3n },
      data: expect.objectContaining({ status: 'processing', originSyncId: 'origin_1' })
    });
  });

  it('persists the attempt before calling Origin', async () => {
    syncManifest.mockImplementation(async () => {
      expect(db.skillDestinationSyncRepositoryPropagation.update).toHaveBeenCalledWith({
        where: { oid: 3n },
        data: { startedAt: now }
      });
      return { id: 'origin_1', status: 'syncing_contents' };
    });

    await perform();

    expect(syncManifest).toHaveBeenCalledOnce();
  });

  it('passes allowMassDelete through for a forced sync', async () => {
    await perform({}, { allowMassDelete: true, trigger: 'manual' });

    expect(syncManifest).toHaveBeenCalledWith(
      expect.objectContaining({ allowMassDelete: true, previousManifest: undefined })
    );
    expect(appendLog).toHaveBeenCalledWith(
      'sync_1',
      'acme/skills: Unexpected deletions are allowed for this sync.'
    );
  });

  it('completes an unchanged repository without calling Origin', async () => {
    db.skillDestinationManifest.findUnique.mockResolvedValue({
      ...manifest,
      sha256: 'sha_old'
    });

    expect(await perform()).toBe('skipped');
    expect(syncManifest).not.toHaveBeenCalled();
    expect(db.skillDestinationSyncRepositoryPropagation.update).toHaveBeenCalledWith({
      where: { oid: 3n },
      data: expect.objectContaining({ status: 'completed' })
    });
    expect(appendLog).toHaveBeenCalledWith('sync_1', 'acme/skills is already up to date.');
  });

  it('sends an unchanged manifest when the sync was forced manually', async () => {
    db.skillDestinationManifest.findUnique.mockResolvedValue({
      ...manifest,
      sha256: 'sha_old'
    });

    expect(await perform({}, { trigger: 'manual' })).toBe('sent');
  });

  it('pauses without calling Origin while the kill switch is off', async () => {
    env.skillSync.SKILL_SYNC_MANIFEST_PROPAGATION_ENABLED = false;
    let warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(await perform()).toBe('paused');
    expect(await perform({ waitingReason: 'propagation_paused' })).toBe('paused');

    expect(syncManifest).not.toHaveBeenCalled();
    expect(db.skillDestinationSyncRepositoryPropagation.update).toHaveBeenCalledWith({
      where: { oid: 3n },
      data: {
        waitingReason: 'propagation_paused',
        waitingUntil: new Date(now.getTime() + 5 * minute)
      }
    });
    expect(warn).toHaveBeenCalledOnce();
    expect(appendLog).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('hands the propagation to the repair cron when Origin has manifest sync disabled', async () => {
    syncManifest.mockRejectedValue(
      new ServiceError(conflictError({ message: 'disabled', code: 'manifest_sync_disabled' }))
    );

    expect(await perform({}, {})).toBe('done');
    expect(syncManifest).toHaveBeenCalledOnce();
    expect(db.skillDestinationSyncRepositoryPropagation.updateMany).toHaveBeenCalledWith({
      where: { oid: 3n, status: { in: ['pending', 'processing', 'waiting_for_review'] } },
      data: expect.objectContaining({
        status: 'failed',
        errorCode: 'manifest_sync_disabled',
        errorMessage:
          'Repository updates are paused by the repository service. Metorial retries automatically.'
      })
    });
    expect(db.skillRepository.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { nextRepairAt: new Date(now.getTime() + 15 * minute) }
    });
    expect(appendLog).toHaveBeenCalledWith(
      'sync_1',
      'acme/skills: Repository updates are paused by the repository service. Metorial retries automatically.'
    );
  });

  it('rethrows other Origin rejections', async () => {
    syncManifest.mockRejectedValue(
      new ServiceError(badRequestError({ message: 'bad', code: 'invalid_data' }))
    );

    await expect(perform()).rejects.toBeInstanceOf(ServiceError);
    expect(db.skillRepository.update).not.toHaveBeenCalled();
  });

  it('fails without calling Origin when the manifest is gone', async () => {
    db.skillDestinationManifest.findUnique.mockResolvedValue(null);

    expect(await perform()).toBe('done');
    expect(syncManifest).not.toHaveBeenCalled();
    expect(db.skillDestinationSyncRepositoryPropagation.update).toHaveBeenCalledWith({
      where: { oid: 3n },
      data: expect.objectContaining({ status: 'failed', errorCode: 'manifest_missing' })
    });
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        issue: 'propagation_failed',
        errorCode: 'manifest_missing',
        propagationId: 'propagation_1'
      })
    );
  });

  it('does not resend an already acknowledged propagation', async () => {
    expect(await perform({ originSyncId: 'origin_1', status: 'processing' })).toBe('done');
    expect(syncManifest).not.toHaveBeenCalled();
  });
});

describe('reconciling Origin state', () => {
  it.each(['merged', 'complete_direct_push', 'complete_no_changes'])(
    'records the last propagated manifest when %s lands on the base branch',
    async status => {
      await reconcile({ status, resultStats: { filesUploaded: 2 } });

      expect(db.skillRepository.update).toHaveBeenCalledWith({
        where: { oid: 1n },
        data: {
          repairAttempts: 0,
          nextRepairAt: null,
          sourceRecoveryLimitWindows: 0,
          sourceRecoveryLimitReachedAt: null,
          lastPropagatedManifestOid: 70n,
          lastPropagatedAt: now,
          lastDriftCheckAt: now,
          dismissedManifestSha256: null
        }
      });
      expect(appendLog).toHaveBeenCalledWith(
        'sync_1',
        'Repository update completed for acme/skills (2 uploaded).'
      );
    }
  );

  it('keeps the last propagated manifest for an unmerged pull request', async () => {
    await reconcile({ status: 'complete_unmerged' });

    expect(db.skillDestinationSyncRepositoryPropagation.updateMany).toHaveBeenCalledWith({
      where: { oid: 3n, status: { in: ['processing', 'waiting_for_review'] } },
      data: expect.objectContaining({ status: 'completed' })
    });
    expect(db.skillRepository.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: {
        repairAttempts: 0,
        nextRepairAt: null,
        sourceRecoveryLimitWindows: 0,
        sourceRecoveryLimitReachedAt: null
      }
    });
  });

  it('records a drift check only once its propagation completes', async () => {
    await reconcileManifestPropagation({
      skillDestinationSyncId: 'sync_1',
      sync: { ...sync, trigger: 'drift_check' },
      propagation: propagation({ status: 'processing', originSyncId: 'origin_1' }),
      originSync: { id: 'origin_1', status: 'complete_unmerged' },
      repositoryName: 'acme/skills',
      formatWaitingForReviewMessage: () => ''
    });

    expect(db.skillRepository.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: expect.objectContaining({ lastDriftCheckAt: now })
    });
  });

  it('leaves the drift check time alone when a drift check fails', async () => {
    await reconcileManifestPropagation({
      skillDestinationSyncId: 'sync_1',
      sync: { ...sync, trigger: 'drift_check' },
      propagation: propagation({ status: 'processing', originSyncId: 'origin_1' }),
      originSync: { id: 'origin_1', status: 'failed', errorCode: 'rate_limited' },
      repositoryName: 'acme/skills',
      formatWaitingForReviewMessage: () => ''
    });

    for (let [args] of db.skillRepository.update.mock.calls) {
      expect(args.data).not.toHaveProperty('lastDriftCheckAt');
    }
  });

  it('stores the error code and never repairs a tripped deletion guard', async () => {
    await reconcile({
      status: 'failed',
      errorCode: 'deletion_guard_tripped',
      errorDetails: { unexpectedDeletes: 300, paths: ['a.md', 'b.md'] }
    });

    expect(db.skillDestinationSyncRepositoryPropagation.updateMany).toHaveBeenCalledWith({
      where: { oid: 3n, status: { in: ['processing', 'waiting_for_review'] } },
      data: expect.objectContaining({
        status: 'failed',
        errorCode: 'deletion_guard_tripped',
        errorMessage:
          "Sync would delete 300 files Metorial didn't expect; review and force the sync to continue.",
        errorDetails: expect.objectContaining({
          unexpectedDeletes: 300,
          paths: ['a.md', 'b.md']
        })
      })
    });
    expect(appendLog).toHaveBeenCalledWith(
      'sync_1',
      'acme/skills: Files that would be deleted include a.md, b.md.'
    );
    expect(db.skillRepository.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { nextRepairAt: null }
    });
  });

  it.each([
    'destination_too_large',
    'file_too_large',
    'lfs_quota_exceeded',
    'path_conflict',
    'tree_too_large',
    'permission_denied'
  ])('does not schedule a repair for %s', async errorCode => {
    await reconcile({ status: 'failed', errorCode });

    expect(db.skillRepository.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { nextRepairAt: null }
    });
  });

  it('explains a path conflict with the blocking repository path', async () => {
    await reconcile({
      status: 'failed',
      errorCode: 'path_conflict',
      errorDetails: { path: 'plugins/a/SKILL.md', paths: ['plugins/a'] }
    });

    expect(db.skillDestinationSyncRepositoryPropagation.updateMany).toHaveBeenCalledWith({
      where: { oid: 3n, status: { in: ['processing', 'waiting_for_review'] } },
      data: expect.objectContaining({
        status: 'failed',
        errorCode: 'path_conflict',
        errorMessage:
          "plugins/a/SKILL.md can't be written because plugins/a in the repository is in the way. Move or remove it there, then sync again."
      })
    });
    expect(recoverMissingManifestSources).not.toHaveBeenCalled();
  });

  it('alerts on an invalid manifest and never retries it', async () => {
    let error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await reconcile({ status: 'failed', errorCode: 'manifest_invalid' });

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('cargo_skill_sync_manifest_invalid')
    );
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        issue: 'propagation_failed',
        errorCode: 'manifest_invalid',
        level: 'error'
      })
    );
    expect(db.skillRepository.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { nextRepairAt: null }
    });
    error.mockRestore();
  });

  it.each(['deletion_guard_tripped', 'rate_limited', 'upstream_failure'])(
    'leaves reporting a %s failure to Origin',
    async errorCode => {
      await reconcile({ status: 'failed', errorCode });

      expect(report).not.toHaveBeenCalled();
    }
  );

  it('reports a sync Metorial stopped waiting for', async () => {
    await reconcile(
      { status: 'syncing_contents' },
      { startedAt: new Date(now.getTime() - 3 * 24 * hour) }
    );

    expect(db.skillDestinationSyncRepositoryPropagation.updateMany).toHaveBeenCalledWith({
      where: { oid: 3n, status: { in: ['processing', 'waiting_for_review'] } },
      data: expect.objectContaining({ status: 'failed', errorCode: 'sync_timeout' })
    });
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        issue: 'propagation_failed',
        errorCode: 'sync_timeout',
        level: 'warning',
        extra: expect.objectContaining({ originStatus: 'syncing_contents' })
      })
    );
  });

  it('schedules a repair for retryable failures using the repository backoff', async () => {
    await reconcile(
      { status: 'failed', errorCode: 'rate_limited' },
      { skillRepository: { oid: 1n, repoId: 'repo_1', repairAttempts: 2, project: {} } }
    );

    expect(db.skillRepository.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { nextRepairAt: new Date(now.getTime() + 4 * hour) }
    });
  });

  it('rebuilds missing sources in a new sync instead of scheduling a repair', async () => {
    recoverMissingManifestSources.mockResolvedValue({
      status: 'started',
      sync: { id: 'sync_recovery', oid: 11n }
    });

    await reconcile({
      status: 'failed',
      errorCode: 'source_not_found',
      errorDetails: { keys: ['blob/abc'] }
    });

    expect(recoverMissingManifestSources).toHaveBeenCalledWith({
      destinationOid: 5n,
      afterSyncOid: 10n,
      keys: ['blob/abc']
    });
    expect(appendLog).toHaveBeenCalledWith(
      'sync_1',
      'Rebuilding the affected files in a new sync.'
    );
    expect(db.skillRepository.update).not.toHaveBeenCalled();
  });

  it('rebuilds the source behind a content mismatch like a missing source', async () => {
    recoverMissingManifestSources.mockResolvedValue({
      status: 'started',
      sync: { id: 'sync_recovery', oid: 11n }
    });

    await reconcile({
      status: 'failed',
      errorCode: 'content_mismatch',
      errorDetails: { key: 'blob/bad', path: 'a.md' }
    });

    expect(recoverMissingManifestSources).toHaveBeenCalledWith({
      destinationOid: 5n,
      afterSyncOid: 10n,
      keys: ['blob/bad']
    });
    expect(db.skillRepository.update).not.toHaveBeenCalled();
  });

  it('fails clearly and keeps repairing while the recovery limit is reached', async () => {
    let warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    recoverMissingManifestSources.mockResolvedValue({ status: 'limit_reached' });
    recordSourceRecoveryLimitReached.mockResolvedValue({ windows: 1, exhausted: false });

    await reconcile({ status: 'failed', errorCode: 'source_not_found' });

    expect(recordSourceRecoveryLimitReached).toHaveBeenCalledWith({ skillRepositoryOid: 1n });
    expect(db.skillDestinationSyncRepositoryPropagation.update).toHaveBeenCalledWith({
      where: { oid: 3n },
      data: {
        errorCode: 'source_not_found',
        errorMessage: 'Files are still missing from storage after repeated rebuilds.'
      }
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('cargo_skill_sync_source_recovery_limit_reached')
    );
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ issue: 'source_recovery_limit_reached', level: 'warning' })
    );
    expect(db.skillRepository.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { nextRepairAt: new Date(now.getTime() + 15 * minute) }
    });
    warn.mockRestore();
  });

  it('marks the repository recovery_exhausted and stops repairing after repeated limit windows', async () => {
    let error = vi.spyOn(console, 'error').mockImplementation(() => {});
    recoverMissingManifestSources.mockResolvedValue({ status: 'limit_reached' });
    recordSourceRecoveryLimitReached.mockResolvedValue({ windows: 3, exhausted: true });

    await reconcile({ status: 'failed', errorCode: 'content_mismatch' });

    expect(db.skillDestinationSyncRepositoryPropagation.update).toHaveBeenCalledWith({
      where: { oid: 3n },
      data: {
        errorCode: 'recovery_exhausted',
        errorMessage:
          'Metorial kept failing to rebuild missing or damaged files and stopped retrying. Edit or re-save the affected skills, then sync again.'
      }
    });
    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(/cargo_skill_sync_source_recovery_exhausted.*"level":"error"/)
    );
    expect(report).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        issue: 'source_recovery_exhausted',
        errorCode: 'content_mismatch',
        level: 'error'
      })
    );
    expect(db.skillRepository.update).toHaveBeenCalledExactlyOnceWith({
      where: { oid: 1n },
      data: { nextRepairAt: null }
    });
    error.mockRestore();
  });

  it('records a dismissed pull request so the same content is not proposed again', async () => {
    db.skillDestinationManifest.findUnique.mockResolvedValue({ sha256: 'sha_new' });

    await reconcile({ status: 'cancelled', endReason: 'pull_request_closed' });

    expect(db.skillDestinationSyncRepositoryPropagation.updateMany).toHaveBeenCalledWith({
      where: { oid: 3n, status: { in: ['processing', 'waiting_for_review'] } },
      data: expect.objectContaining({ status: 'canceled', endReason: 'pull_request_closed' })
    });
    expect(db.skillRepository.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { dismissedManifestSha256: 'sha_new', nextRepairAt: null, repairAttempts: 0 }
    });
    expect(appendLog).toHaveBeenCalledWith(
      'sync_1',
      'acme/skills: The pull request was closed.'
    );
  });

  it('dismisses a sync whose branch Origin found missing', async () => {
    db.skillDestinationManifest.findUnique.mockResolvedValue({ sha256: 'sha_new' });

    await reconcile({ status: 'cancelled', endReason: 'branch_deleted' });

    expect(db.skillDestinationSyncRepositoryPropagation.updateMany).toHaveBeenCalledWith({
      where: { oid: 3n, status: { in: ['processing', 'waiting_for_review'] } },
      data: expect.objectContaining({
        status: 'canceled',
        endReason: 'branch_deleted',
        errorMessage: null
      })
    });
    expect(db.skillRepository.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { dismissedManifestSha256: 'sha_new', nextRepairAt: null, repairAttempts: 0 }
    });
    expect(appendLog).toHaveBeenCalledWith(
      'sync_1',
      'acme/skills: The sync branch was deleted.'
    );
  });

  it('cancels a superseded propagation without dismissing or failing it', async () => {
    await reconcile({ status: 'cancelled', endReason: 'superseded' });

    expect(db.skillDestinationSyncRepositoryPropagation.updateMany).toHaveBeenCalledWith({
      where: { oid: 3n, status: { in: ['processing', 'waiting_for_review'] } },
      data: expect.objectContaining({ status: 'canceled', endReason: 'superseded' })
    });
    expect(db.skillRepository.update).not.toHaveBeenCalled();
    expect(appendLog).toHaveBeenCalledWith(
      'sync_1',
      'acme/skills: Continued in a newer sync.'
    );
  });

  it('stores the waiting state while Origin waits out a rate limit', async () => {
    let nextPollAt = new Date(now.getTime() + 10 * minute);

    let result = await reconcile({
      status: 'syncing_contents',
      errorCode: 'rate_limited',
      nextPollAt
    });

    expect(result).toEqual({ waitingUntil: nextPollAt });
    expect(db.skillDestinationSyncRepositoryPropagation.updateMany).toHaveBeenCalledWith({
      where: { oid: 3n, status: 'processing' },
      data: expect.objectContaining({
        status: 'processing',
        waitingReason: 'rate_limited',
        waitingUntil: nextPollAt
      })
    });
    expect(appendLog).toHaveBeenCalledWith(
      'sync_1',
      `acme/skills: Waiting for the provider rate limit; resumes at ${nextPollAt.toISOString()}.`
    );
  });

  it('logs merge-readiness retries without copying provider responses', async () => {
    let nextPollAt = new Date(now.getTime() + minute);

    await reconcile({
      status: 'waiting_for_ci',
      errorCode: 'merge_not_ready',
      errorMessage: 'raw provider response',
      nextPollAt
    });

    expect(appendLog).toHaveBeenCalledWith(
      'sync_1',
      `acme/skills: The repository isn't ready to merge yet. The sync will retry automatically; resumes at ${nextPollAt.toISOString()}.`
    );
    expect(JSON.stringify(appendLog.mock.calls)).not.toContain('raw provider response');
  });

  it('logs recovery when a repository retry ends', async () => {
    await reconcile(
      { status: 'waiting_for_ci', errorMessage: null, nextPollAt: now },
      { waitingReason: 'merge_not_ready', waitingUntil: now }
    );

    expect(appendLog).toHaveBeenCalledWith('sync_1', 'acme/skills: Repository sync resumed.');
  });

  it("uses Origin's waiting reason and time when it reports them", async () => {
    let waitingUntil = new Date(now.getTime() + 3 * minute);

    let result = await reconcile({
      status: 'syncing_contents',
      waitingReason: 'provider_unavailable',
      waitingUntil,
      nextPollAt: new Date(now.getTime() + 30 * minute),
      errorMessage: 'rate limit wording that the heuristic would misread'
    });

    expect(result).toEqual({ waitingUntil });
    expect(db.skillDestinationSyncRepositoryPropagation.updateMany).toHaveBeenCalledWith({
      where: { oid: 3n, status: 'processing' },
      data: expect.objectContaining({ waitingReason: 'provider_unavailable', waitingUntil })
    });
    expect(appendLog).toHaveBeenCalledWith(
      'sync_1',
      `acme/skills: The provider is temporarily unavailable; resumes at ${waitingUntil.toISOString()}.`
    );
  });

  it('is not waiting when Origin reports no waiting reason, whatever the error fields say', async () => {
    let result = await reconcile({
      status: 'syncing_contents',
      waitingReason: null,
      waitingUntil: null,
      errorCode: 'rate_limited',
      nextPollAt: new Date(now.getTime() + 10 * minute)
    });

    expect(result).toEqual({ waitingUntil: null });
    expect(db.skillDestinationSyncRepositoryPropagation.updateMany).not.toHaveBeenCalled();
  });

  it('reads back the branch name Origin used', async () => {
    await reconcile({ status: 'waiting_for_review', branchName: 'metorial/sync-adopted' });

    expect(db.skillDestinationSyncRepositoryPropagation.updateMany).toHaveBeenCalledWith({
      where: { oid: 3n, status: 'processing' },
      data: expect.objectContaining({
        status: 'waiting_for_review',
        branchName: 'metorial/sync-adopted'
      })
    });
    expect(appendLog).toHaveBeenCalledWith('sync_1', 'acme/skills: Waiting for review.');
  });

  it('does not touch a propagation whose state did not change', async () => {
    await reconcile({ status: 'waiting_for_review' }, { status: 'waiting_for_review' });

    expect(db.skillDestinationSyncRepositoryPropagation.updateMany).not.toHaveBeenCalled();
  });
});
