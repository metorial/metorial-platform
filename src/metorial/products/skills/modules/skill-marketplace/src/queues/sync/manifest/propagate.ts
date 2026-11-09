import { ServiceError } from '@lowerdeck/error';
import type {
  Project,
  SkillDestination,
  SkillDestinationSync,
  SkillDestinationSyncRepositoryPropagation,
  SkillRepository
} from '@metorial/db';
import { db } from '@metorial/db';
import { getCargoFilesBucketName } from '@metorial/module-file';
import { getOriginTenant, origin } from '@metorial/skills-scm-utils';
import { env } from '../../../env';
import { appendSkillDestinationSyncLog } from '../_lib/logs';
import {
  getManifestErrorMessage,
  isRetryableManifestErrorCode,
  type ManifestOriginSync,
  resolveManifestPropagationOutcome,
  summarizeResultStats
} from './originSync';
import {
  getSourceRecoveryKeys,
  isSourceRecoveryErrorCode,
  recordSourceRecoveryLimitReached,
  recoverMissingManifestSources
} from './recovery';

export let manifestPropagationPauseMs = 5 * 60 * 1000;

let activeStatuses = ['processing', 'waiting_for_review'] as const;

type ManifestSync = SkillDestinationSync & { destination: SkillDestination };

type ManifestPropagation = SkillDestinationSyncRepositoryPropagation & {
  skillRepository: SkillRepository & { project: Project };
};

export let getRepairDelayMs = (repairAttempts: number) => {
  let backoff = env.skillSync.SKILL_SYNC_REPAIR_BACKOFF;
  let seconds =
    backoff[Math.min(Math.max(repairAttempts, 0), backoff.length - 1)] ?? 12 * 3600;
  return seconds * 1000;
};

export let shouldSkipManifestPropagation = (d: {
  trigger: SkillDestinationSync['trigger'];
  manifestSha256: string;
  repository: Pick<SkillRepository, 'lastDriftCheckAt' | 'dismissedManifestSha256'> & {
    lastPropagatedManifest: { sha256: string } | null;
  };
  previousPropagationStatus: string | null;
  now: Date;
  driftCheckIntervalMs: number;
}): 'unchanged' | 'dismissed' | null => {
  if (d.trigger === 'manual') return null;

  if (d.repository.dismissedManifestSha256 === d.manifestSha256) return 'dismissed';

  let driftCheckFresh =
    !!d.repository.lastDriftCheckAt &&
    d.now.getTime() - d.repository.lastDriftCheckAt.getTime() < d.driftCheckIntervalMs;
  if (
    d.trigger !== 'drift_check' &&
    d.repository.lastPropagatedManifest?.sha256 === d.manifestSha256 &&
    d.previousPropagationStatus === 'completed' &&
    driftCheckFresh
  ) {
    return 'unchanged';
  }

  return null;
};

let pausePropagation = async (d: {
  skillDestinationSyncId: string;
  propagation: ManifestPropagation;
  reason: string;
  message: string;
}) => {
  await db.skillDestinationSyncRepositoryPropagation.update({
    where: { oid: d.propagation.oid },
    data: {
      waitingReason: d.reason,
      waitingUntil: new Date(Date.now() + manifestPropagationPauseMs)
    }
  });

  if (d.propagation.waitingReason !== d.reason) {
    console.warn(
      JSON.stringify({
        event: `cargo_skill_${d.reason}`,
        level: 'warn',
        skillDestinationSyncId: d.skillDestinationSyncId,
        propagationId: d.propagation.id
      })
    );
    await appendSkillDestinationSyncLog(d.skillDestinationSyncId, d.message);
  }

  return 'paused' as const;
};

let getPreviousPropagationStatus = async (propagation: ManifestPropagation) => {
  let previous = await db.skillDestinationSyncRepositoryPropagation.findFirst({
    where: {
      skillRepositoryOid: propagation.skillRepositoryOid,
      oid: { lt: propagation.oid },
      NOT: { status: 'canceled', originSyncId: null }
    },
    orderBy: { oid: 'desc' },
    select: { status: true }
  });

  return previous?.status ?? null;
};

export let performManifestPropagation = async (d: {
  skillDestinationSyncId: string;
  sync: ManifestSync;
  propagation: ManifestPropagation;
  getRepositoryName: () => Promise<string>;
}): Promise<'sent' | 'paused' | 'skipped' | 'done'> => {
  let { sync, propagation } = d;

  if (['completed', 'canceled', 'failed'].includes(propagation.status)) return 'done';

  if (propagation.originSyncId) {
    if (propagation.status === 'pending') {
      await db.skillDestinationSyncRepositoryPropagation.update({
        where: { oid: propagation.oid },
        data: { status: 'processing', startedAt: propagation.startedAt ?? new Date() }
      });
    }
    return 'done';
  }

  if (!env.skillSync.SKILL_SYNC_MANIFEST_PROPAGATION_ENABLED) {
    return await pausePropagation({
      skillDestinationSyncId: d.skillDestinationSyncId,
      propagation,
      reason: 'propagation_paused',
      message: 'Repository updates are paused. They resume automatically.'
    });
  }

  let repositoryName = await d.getRepositoryName();
  let [manifest, repository, previousPropagationStatus] = await Promise.all([
    propagation.manifestOid
      ? db.skillDestinationManifest.findUnique({ where: { oid: propagation.manifestOid } })
      : null,
    db.skillRepository.findUniqueOrThrow({
      where: { oid: propagation.skillRepositoryOid },
      include: { lastPropagatedManifest: { select: { sha256: true } } }
    }),
    getPreviousPropagationStatus(propagation)
  ]);

  if (!manifest) {
    await db.skillDestinationSyncRepositoryPropagation.update({
      where: { oid: propagation.oid },
      data: {
        status: 'failed',
        errorCode: 'manifest_missing',
        errorMessage: 'The content snapshot for this update no longer exists.',
        completedAt: new Date()
      }
    });
    await appendSkillDestinationSyncLog(
      d.skillDestinationSyncId,
      `${repositoryName}: The content snapshot for this update no longer exists.`
    );
    return 'done';
  }

  let skip = shouldSkipManifestPropagation({
    trigger: sync.trigger,
    manifestSha256: manifest.sha256,
    repository,
    previousPropagationStatus,
    now: new Date(),
    driftCheckIntervalMs: env.skillSync.SKILL_SYNC_DRIFT_CHECK_INTERVAL * 1000
  });
  if (skip) {
    await db.skillDestinationSyncRepositoryPropagation.update({
      where: { oid: propagation.oid },
      data: {
        status: 'completed',
        startedAt: propagation.startedAt ?? new Date(),
        completedAt: new Date(),
        waitingReason: null,
        waitingUntil: null
      }
    });
    await appendSkillDestinationSyncLog(
      d.skillDestinationSyncId,
      skip === 'unchanged'
        ? `${repositoryName} is already up to date.`
        : `${repositoryName}: Skipped; this content was proposed before and its pull request was closed.`
    );
    return 'skipped';
  }

  let previousManifest = propagation.previousManifestSha256
    ? await db.skillDestinationManifest.findUnique({
        where: {
          destinationOid_sha256: {
            destinationOid: sync.destinationOid,
            sha256: propagation.previousManifestSha256
          }
        }
      })
    : null;
  let bucket = getCargoFilesBucketName();
  let isPullRequest = propagation.repositoryAccessMode === 'pull_request';
  let originTenant = await getOriginTenant(propagation.skillRepository.project);

  let startedAt = propagation.startedAt ?? new Date();
  // Persisted before the RPC so a lost acknowledgement stays in flight; requestKey makes the
  // retried call idempotent.
  await db.skillDestinationSyncRepositoryPropagation.update({
    where: { oid: propagation.oid },
    data: { startedAt }
  });

  let originSync: ManifestOriginSync;
  try {
    originSync = (await origin.scmRepository.syncManifest({
      tenantId: originTenant.id,
      scmRepositoryId: propagation.skillRepository.repoId,
      requestKey: propagation.id,
      sourceKey: sync.destination.id,
      manifest: {
        bucket,
        key: manifest.objectKey,
        sha256: manifest.sha256,
        entryCount: manifest.entryCount
      },
      previousManifest: previousManifest
        ? { bucket, key: previousManifest.objectKey, sha256: previousManifest.sha256 }
        : undefined,
      deletionGuard: {
        maxUnexpectedDeletes: env.skillSync.SKILL_SYNC_DELETION_GUARD_MAX_UNEXPECTED_DELETES,
        maxUnexpectedDeleteRatio:
          env.skillSync.SKILL_SYNC_DELETION_GUARD_MAX_UNEXPECTED_DELETE_RATIO
      },
      allowMassDelete: sync.allowMassDelete,
      gitLfsThresholdBytes:
        propagation.skillRepository.project.skillSyncGitLfsThresholdBytes ?? undefined,
      repositoryAccessMode: propagation.repositoryAccessMode,
      forceMergeOrPush: propagation.forceMergeOrPush,
      mergeBeforeChecksPass: propagation.mergeBeforeChecksPass,
      branchName: isPullRequest ? propagation.branchName : undefined,
      prName: isPullRequest ? propagation.prName : undefined,
      prDescription: propagation.prDescription ?? undefined,
      commitMessage: propagation.commitMessage ?? propagation.prName,
      enableAutoMerge: isPullRequest ? true : undefined
    })) as ManifestOriginSync;
  } catch (error) {
    if (error instanceof ServiceError && error.data.code === 'manifest_sync_disabled') {
      await deferPropagationToRepair({
        skillDestinationSyncId: d.skillDestinationSyncId,
        propagation,
        repositoryName,
        errorCode: 'manifest_sync_disabled'
      });
      return 'done';
    }
    throw error;
  }

  await db.skillDestinationSyncRepositoryPropagation.update({
    where: { oid: propagation.oid },
    data: {
      status: 'processing',
      startedAt,
      originSyncId: originSync.id,
      branchName: originSync.branchName ?? propagation.branchName,
      waitingReason: null,
      waitingUntil: null
    }
  });

  if (sync.allowMassDelete) {
    await appendSkillDestinationSyncLog(
      d.skillDestinationSyncId,
      `${repositoryName}: Unexpected deletions are allowed for this sync.`
    );
  }

  return 'sent';
};

let scheduleRepair = async (d: {
  repository: Pick<SkillRepository, 'oid' | 'repairAttempts'>;
  errorCode: string;
}) => {
  await db.skillRepository.update({
    where: { oid: d.repository.oid },
    data: {
      nextRepairAt: isRetryableManifestErrorCode(d.errorCode)
        ? new Date(Date.now() + getRepairDelayMs(d.repository.repairAttempts))
        : null
    }
  });
};

let deferPropagationToRepair = async (d: {
  skillDestinationSyncId: string;
  propagation: ManifestPropagation;
  repositoryName: string;
  errorCode: string;
}) => {
  let errorMessage = getManifestErrorMessage({ errorCode: d.errorCode });
  let updated = await db.skillDestinationSyncRepositoryPropagation.updateMany({
    where: { oid: d.propagation.oid, status: { in: ['pending', ...activeStatuses] } },
    data: {
      status: 'failed',
      errorCode: d.errorCode,
      errorMessage,
      waitingReason: null,
      waitingUntil: null,
      completedAt: new Date()
    }
  });
  if (updated.count === 0) return;

  await appendSkillDestinationSyncLog(
    d.skillDestinationSyncId,
    `${d.repositoryName}: ${errorMessage}`
  );
  await scheduleRepair({ repository: d.propagation.skillRepository, errorCode: d.errorCode });
};

let toStoredErrorDetails = (
  details: ManifestOriginSync['errorDetails']
): PrismaJson.SkillSyncPropagationErrorDetails | undefined => {
  if (!details) return undefined;

  let keys = getSourceRecoveryKeys(details);
  return {
    unexpectedDeletes: details.unexpectedDeletes,
    total: details.total,
    path: details.path,
    paths: details.paths?.slice(0, 10),
    keys: keys?.slice(0, 20)
  };
};

let sourceRecoveryLimitMessages: Record<string, string> = {
  source_not_found: 'Files are still missing from storage after repeated rebuilds.',
  content_mismatch: "Stored files still don't match their content after repeated rebuilds."
};

export let handleSourceRecoveryLimitReached = async (d: {
  skillDestinationSyncId: string;
  propagation: Pick<SkillDestinationSyncRepositoryPropagation, 'oid' | 'id' | 'errorCode'>;
  skillRepositoryOid: bigint;
  repositoryName?: string;
  keys?: string[];
}) => {
  let { windows, exhausted } = await recordSourceRecoveryLimitReached({
    skillRepositoryOid: d.skillRepositoryOid
  });
  let errorCode = exhausted ? 'recovery_exhausted' : d.propagation.errorCode;
  let errorMessage = exhausted
    ? getManifestErrorMessage({ errorCode: 'recovery_exhausted' })
    : (sourceRecoveryLimitMessages[d.propagation.errorCode ?? ''] ??
      sourceRecoveryLimitMessages.source_not_found!);

  await db.skillDestinationSyncRepositoryPropagation.update({
    where: { oid: d.propagation.oid },
    data: { errorCode, errorMessage }
  });
  if (exhausted) {
    await db.skillRepository.update({
      where: { oid: d.skillRepositoryOid },
      data: { nextRepairAt: null }
    });
  }
  await appendSkillDestinationSyncLog(
    d.skillDestinationSyncId,
    d.repositoryName ? `${d.repositoryName}: ${errorMessage}` : errorMessage
  );

  let log = exhausted ? console.error : console.warn;
  log(
    JSON.stringify({
      event: exhausted
        ? 'cargo_skill_sync_source_recovery_exhausted'
        : 'cargo_skill_sync_source_recovery_limit_reached',
      level: exhausted ? 'error' : 'warn',
      skillDestinationSyncId: d.skillDestinationSyncId,
      propagationId: d.propagation.id,
      originErrorCode: d.propagation.errorCode,
      windows,
      keys: d.keys?.slice(0, 20)
    })
  );

  return exhausted;
};

let failPropagation = async (d: {
  skillDestinationSyncId: string;
  sync: ManifestSync;
  propagation: ManifestPropagation;
  originSync: ManifestOriginSync;
  repositoryName: string;
  errorCode: string;
  errorMessage: string;
}) => {
  let updated = await db.skillDestinationSyncRepositoryPropagation.updateMany({
    where: { oid: d.propagation.oid, status: { in: [...activeStatuses] } },
    data: {
      status: 'failed',
      errorCode: d.errorCode,
      errorMessage: d.errorMessage,
      waitingReason: null,
      waitingUntil: null,
      errorDetails: toStoredErrorDetails(d.originSync.errorDetails),
      resultStats: (d.originSync.resultStats as PrismaJson.SkillSyncResultStats) ?? undefined,
      completedAt: new Date()
    }
  });
  if (updated.count === 0) return;

  await appendSkillDestinationSyncLog(
    d.skillDestinationSyncId,
    `${d.repositoryName}: ${d.errorMessage}`
  );

  let samplePaths = d.originSync.errorDetails?.paths?.slice(0, 10) ?? [];
  if (d.errorCode === 'deletion_guard_tripped' && samplePaths.length) {
    await appendSkillDestinationSyncLog(
      d.skillDestinationSyncId,
      `${d.repositoryName}: Files that would be deleted include ${samplePaths.join(', ')}.`
    );
  }

  if (isSourceRecoveryErrorCode(d.errorCode)) {
    let keys = getSourceRecoveryKeys(d.originSync.errorDetails);
    let recovery = await recoverMissingManifestSources({
      destinationOid: d.sync.destinationOid,
      afterSyncOid: d.sync.oid,
      keys
    });
    if (recovery.status !== 'limit_reached') {
      if (recovery.status === 'started') {
        await appendSkillDestinationSyncLog(
          d.skillDestinationSyncId,
          'Rebuilding the affected files in a new sync.'
        );
      }
      return;
    }

    let exhausted = await handleSourceRecoveryLimitReached({
      skillDestinationSyncId: d.skillDestinationSyncId,
      propagation: { oid: d.propagation.oid, id: d.propagation.id, errorCode: d.errorCode },
      skillRepositoryOid: d.propagation.skillRepositoryOid,
      repositoryName: d.repositoryName,
      keys
    });
    if (exhausted) return;
  }

  if (d.errorCode === 'manifest_invalid') {
    console.error(
      JSON.stringify({
        event: 'cargo_skill_sync_manifest_invalid',
        level: 'error',
        skillDestinationSyncId: d.skillDestinationSyncId,
        propagationId: d.propagation.id,
        originSyncId: d.originSync.id,
        originError: d.originSync.errorMessage
      })
    );
  }

  await scheduleRepair({ repository: d.propagation.skillRepository, errorCode: d.errorCode });
};

export let reconcileManifestPropagation = async (d: {
  skillDestinationSyncId: string;
  sync: ManifestSync;
  propagation: ManifestPropagation;
  originSync: ManifestOriginSync;
  repositoryName: string;
  formatWaitingForReviewMessage: () => string;
}): Promise<{ waitingUntil: Date | null }> => {
  let { propagation, originSync } = d;
  let now = new Date();
  let outcome = resolveManifestPropagationOutcome({
    originSync,
    repositoryAccessMode: propagation.repositoryAccessMode,
    startedAt: propagation.startedAt,
    now,
    maxLifetimeMs: env.skillSync.SKILL_SYNC_MAX_SYNC_LIFETIME * 1000
  });
  let branchName = originSync.branchName || propagation.branchName;
  let resultStats = (originSync.resultStats as PrismaJson.SkillSyncResultStats) ?? undefined;

  if (outcome.type === 'completed') {
    let updated = await db.skillDestinationSyncRepositoryPropagation.updateMany({
      where: { oid: propagation.oid, status: { in: [...activeStatuses] } },
      data: {
        status: 'completed',
        branchName,
        resultStats,
        endReason: originSync.endReason ?? null,
        waitingReason: null,
        waitingUntil: null,
        completedAt: now
      }
    });
    if (updated.count === 0) return { waitingUntil: null };

    await db.skillRepository.update({
      where: { oid: propagation.skillRepositoryOid },
      data: {
        repairAttempts: 0,
        nextRepairAt: null,
        sourceRecoveryLimitWindows: 0,
        sourceRecoveryLimitReachedAt: null,
        ...(d.sync.trigger === 'drift_check' ? { lastDriftCheckAt: now } : {}),
        ...(outcome.onBaseBranch && propagation.manifestOid
          ? {
              lastPropagatedManifestOid: propagation.manifestOid,
              lastPropagatedAt: now,
              lastDriftCheckAt: now,
              dismissedManifestSha256: null
            }
          : {})
      }
    });

    let summary = summarizeResultStats(originSync.resultStats);
    await appendSkillDestinationSyncLog(
      d.skillDestinationSyncId,
      `Repository update completed for ${d.repositoryName}${summary ? ` (${summary})` : ''}.`
    );
    return { waitingUntil: null };
  }

  if (outcome.type === 'failed') {
    await failPropagation({
      ...d,
      errorCode: outcome.errorCode,
      errorMessage: outcome.errorMessage
    });
    return { waitingUntil: null };
  }

  if (outcome.type === 'canceled') {
    let updated = await db.skillDestinationSyncRepositoryPropagation.updateMany({
      where: { oid: propagation.oid, status: { in: [...activeStatuses] } },
      data: {
        status: 'canceled',
        branchName,
        resultStats,
        endReason: outcome.endReason,
        errorMessage: outcome.endReason ? null : originSync.errorMessage,
        waitingReason: null,
        waitingUntil: null,
        completedAt: now
      }
    });
    if (updated.count === 0) return { waitingUntil: null };

    if (outcome.dismissed) {
      let manifest = propagation.manifestOid
        ? await db.skillDestinationManifest.findUnique({
            where: { oid: propagation.manifestOid },
            select: { sha256: true }
          })
        : null;
      await db.skillRepository.update({
        where: { oid: propagation.skillRepositoryOid },
        data: {
          dismissedManifestSha256: manifest?.sha256 ?? null,
          nextRepairAt: null,
          repairAttempts: 0
        }
      });
    }

    await appendSkillDestinationSyncLog(
      d.skillDestinationSyncId,
      outcome.endReason === 'superseded'
        ? `${d.repositoryName}: Continued in a newer sync.`
        : outcome.endReason === 'pull_request_closed'
          ? `${d.repositoryName}: The pull request was closed.`
          : outcome.endReason === 'pull_request_deleted'
            ? `${d.repositoryName}: The pull request was deleted.`
            : outcome.endReason === 'branch_deleted'
              ? `${d.repositoryName}: The sync branch was deleted.`
              : `Repository update canceled for ${d.repositoryName}.`
    );
    return { waitingUntil: null };
  }

  let changed =
    propagation.status !== outcome.status ||
    propagation.waitingReason !== outcome.waitingReason ||
    propagation.waitingUntil?.getTime() !== outcome.waitingUntil?.getTime() ||
    propagation.branchName !== branchName ||
    propagation.errorMessage !== null;
  if (!changed) return { waitingUntil: outcome.waitingUntil };

  let updated = await db.skillDestinationSyncRepositoryPropagation.updateMany({
    where: { oid: propagation.oid, status: propagation.status },
    data: {
      status: outcome.status,
      branchName,
      resultStats,
      waitingReason: outcome.waitingReason,
      waitingUntil: outcome.waitingUntil,
      errorMessage: null
    }
  });
  if (updated.count === 0) return { waitingUntil: null };

  if (outcome.waitingUntil && propagation.waitingReason !== outcome.waitingReason) {
    await appendSkillDestinationSyncLog(
      d.skillDestinationSyncId,
      `${d.repositoryName}: ${
        outcome.waitingReason === 'rate_limited'
          ? 'Waiting for the provider rate limit'
          : outcome.waitingReason === 'provider_unavailable'
            ? 'The provider is temporarily unavailable'
            : 'Waiting to retry'
      }; resumes at ${outcome.waitingUntil.toISOString()}.`
    );
  } else if (
    outcome.status === 'waiting_for_review' &&
    propagation.status !== 'waiting_for_review'
  ) {
    await appendSkillDestinationSyncLog(
      d.skillDestinationSyncId,
      `${d.repositoryName}: ${d.formatWaitingForReviewMessage()}`
    );
  }

  return { waitingUntil: outcome.waitingUntil };
};

export let getManifestErrorCodeForRejection = (error: ServiceError<any>) =>
  typeof error.data.code === 'string' ? error.data.code : 'request_rejected';
