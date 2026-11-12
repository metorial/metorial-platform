import { getSentry } from '@lowerdeck/sentry';
import type {
  Prisma,
  ScmRepositorySync,
  ScmRepositorySyncStatus
} from '../../../../prisma/generated/client';
import { db } from '../../../db';
import type { ExportLineage } from '../../../lib/exportError';
import type { RepositorySyncDismissal } from '../../../lib/scmRepositorySyncProvider';
import {
  getScmProviderErrorDetails,
  getScmProviderLogDetails,
  isRetryableScmProviderError,
  toPublicProviderErrorMessage
} from '../../../lib/scmProviderError';
import {
  type RepositorySyncStatusSnapshot,
  isTerminalRepositorySyncStatus,
  transitionRepositorySyncState
} from '../../../services/repositorySyncState';

export let MANIFEST_SYNC_LIFETIME_MS = 48 * 60 * 60_000;
let PERSISTENT_RETRY_ATTEMPT = 3;
let MANIFEST_MAX_RETRY_DELAY_MS = 60 * 60_000;
let MANIFEST_RETRY_JITTER_MS = 30_000;
let MANIFEST_MAX_UNPRODUCTIVE_RATE_LIMITED = 6;
let MANIFEST_MAX_UNPRODUCTIVE_OTHER = 3;

// Failures the repository owner has to resolve (repo rules, access, content size) are not ours
// to alert on.
let expectedRepositorySyncFailures = [
  'protected_branch',
  'missing_branch',
  'permission_denied',
  'authentication_failed',
  'resource_not_found',
  'file_too_large',
  'deletion_guard_tripped',
  'tree_too_large',
  'lfs_quota_exceeded',
  'branch_missing',
  'destination_too_large',
  'path_conflict'
];

let degradedRepositorySyncFailures = [
  'rate_limited',
  'timeout',
  'upstream_failure',
  'conflict',
  'sync_lifetime_exceeded',
  'no_progress'
];

let Sentry = getSentry();

export type RepositorySyncLogEntry = [number, string];

export let getRepositorySyncRetry = (
  error: unknown,
  stage: 'merge' | 'waitForCi' | 'createPr'
) => {
  let details = getScmProviderErrorDetails(error);
  let code =
    stage === 'merge' && [405, 409, 422].includes(details.status ?? 0)
      ? 'merge_not_ready'
      : details.classification;
  let message =
    code === 'merge_not_ready'
      ? "The repository isn't ready to merge yet. The sync will retry automatically."
      : code === 'rate_limited'
        ? 'The repository is limiting requests. The sync will retry automatically.'
        : code === 'authentication_failed'
          ? 'The repository connection needs attention. Reconnect it if the sync does not resume.'
          : code === 'permission_denied' || code === 'protected_branch'
            ? 'Repository access is blocking the sync. Check connection permissions and branch rules.'
            : stage === 'waitForCi'
              ? "We couldn't check the repository status. The sync will retry automatically."
              : stage === 'createPr'
                ? "We couldn't prepare the repository update. The sync will retry automatically."
                : "We couldn't merge the repository update. The sync will retry automatically.";

  return { code, message };
};

export let recordRepositorySyncRetry = async (d: {
  sync: Pick<
    ScmRepositorySync,
    | 'id'
    | 'sourceType'
    | 'repositoryAccessMode'
    | 'attemptCount'
    | 'errorMessage'
    | 'logs'
    | 'statusSnapshot'
  > & { repo?: { provider: string } };
  stage: 'merge' | 'waitForCi' | 'createPr';
  error: unknown;
  delayMs: number;
  retry: { code: string; message: string };
}) => {
  let alreadyLogged =
    Array.isArray(d.sync.logs) &&
    d.sync.logs.some(log => Array.isArray(log) && log[1] === d.retry.message);
  if (d.sync.errorMessage !== d.retry.message && !alreadyLogged) {
    await appendRepositorySyncLog(d.sync.id, d.retry.message);
  }

  // Report the start and persistence of a retry episode, rather than every poll.
  if (![0, PERSISTENT_RETRY_ATTEMPT].includes(d.sync.attemptCount)) return;

  let details = getScmProviderErrorDetails(d.error);
  let snapshot = d.sync.statusSnapshot as RepositorySyncStatusSnapshot | null;
  Sentry.captureMessage('Repository sync is retrying', {
    level:
      d.sync.attemptCount >= PERSISTENT_RETRY_ATTEMPT && d.retry.code !== 'merge_not_ready'
        ? 'error'
        : 'warning',
    fingerprint: [
      'repository-sync-retry',
      d.sync.repo?.provider ?? 'unknown',
      d.stage,
      d.retry.code
    ],
    tags: {
      area: 'repository_sync',
      'repository_sync.stage': d.stage,
      'repository_sync.error_code': d.retry.code,
      'repository_sync.provider': d.sync.repo?.provider ?? 'unknown',
      'repository_sync.source_type': d.sync.sourceType,
      'repository_sync.access_mode': d.sync.repositoryAccessMode
    },
    extra: {
      syncId: d.sync.id,
      attemptCount: d.sync.attemptCount + 1,
      retryInMs: d.delayMs,
      providerDiagnostic: {
        status: details.status,
        classification: details.classification,
        mergeReadiness: details.mergeReadiness,
        method: details.method,
        endpoint: details.endpoint,
        requestId: details.requestId
      },
      observedStatus: snapshot
        ? {
            checks: snapshot.checks.state,
            review: snapshot.review.state,
            mergeability: snapshot.mergeability.state
          }
        : null
    }
  });
};

export let getRepositorySyncFailureLevel = (errorCode: string) =>
  expectedRepositorySyncFailures.includes(errorCode)
    ? null
    : degradedRepositorySyncFailures.includes(errorCode)
      ? ('warning' as const)
      : ('error' as const);

export let reportRepositorySyncFailure = (d: {
  sync: Pick<
    ScmRepositorySync,
    'id' | 'status' | 'sourceType' | 'sourceKey' | 'requestKey' | 'repositoryAccessMode'
  >;
  errorCode: string;
  errorMessage: string;
  error?: unknown;
}) => {
  let level = getRepositorySyncFailureLevel(d.errorCode);
  if (!level) return;

  let context = {
    level,
    tags: {
      area: 'repository_sync',
      'repository_sync.error_code': d.errorCode,
      'repository_sync.stage': d.sync.status,
      'repository_sync.source_type': d.sync.sourceType,
      'repository_sync.access_mode': d.sync.repositoryAccessMode
    },
    extra: {
      syncId: d.sync.id,
      requestKey: d.sync.requestKey,
      sourceKey: d.sync.sourceKey,
      errorMessage: d.errorMessage,
      providerDiagnostic: d.error === undefined ? undefined : getScmProviderLogDetails(d.error)
    },
    fingerprint: ['repository-sync', d.errorCode]
  };

  if (d.error instanceof Error) {
    Sentry.captureException(d.error, context);
  } else {
    Sentry.captureMessage(
      `Repository sync failed (${d.errorCode}): ${d.errorMessage}`,
      context
    );
  }
};

export let getRepositorySyncContentsRetryDelayMs = (d: {
  attemptCount: number;
  error: unknown;
}) =>
  getScmProviderErrorDetails(d.error).classification === 'rate_limited'
    ? Math.min(15 * 60_000, 60_000 * 2 ** d.attemptCount)
    : Math.min(60_000, 2_000 * 2 ** d.attemptCount);

export let shouldRetryRepositorySyncContents = (d: {
  repositoryAccessMode: string;
  status: string;
  attemptCount: number;
  error: unknown;
}) => {
  let classification = getScmProviderErrorDetails(d.error).classification;
  let maxAttempts = classification === 'rate_limited' ? 6 : 3;

  if (d.status !== 'syncing_contents' || d.attemptCount >= maxAttempts) {
    return false;
  }

  return (
    (d.repositoryAccessMode === 'default_branch' && classification === 'conflict') ||
    isRetryableScmProviderError(d.error)
  );
};

export let getManifestSyncRetryDelayMs = (d: {
  retryAfter: Date | null;
  attemptCount: number;
  error: unknown;
  now: number;
}) => {
  let jitter = Math.floor(Math.random() * MANIFEST_RETRY_JITTER_MS);
  let wait = d.retryAfter ? d.retryAfter.getTime() - d.now : 0;
  if (wait > 0) return Math.min(MANIFEST_MAX_RETRY_DELAY_MS, wait + jitter);

  return getRepositorySyncContentsRetryDelayMs({
    attemptCount: d.attemptCount,
    error: d.error
  });
};

// attemptCount counts consecutive slices that ended in an error without committing anything;
// a slice that made progress resets it, so a long sync is bounded by its lifetime instead.
export let getManifestSyncContentsRetry = (d: {
  attemptCount: number;
  madeProgress: boolean;
  createdAt: Date;
  retryAfter: Date | null;
  error: unknown;
  now?: number;
}):
  | { retry: true; attemptCount: number; delayMs: number }
  | { retry: false; reason: 'not_retryable' | 'attempts' | 'lifetime' } => {
  let now = d.now ?? Date.now();
  let classification = getScmProviderErrorDetails(d.error).classification;
  if (!isRetryableScmProviderError(d.error)) return { retry: false, reason: 'not_retryable' };

  let attemptCount = d.madeProgress ? 0 : d.attemptCount + 1;
  let maxAttempts =
    classification === 'rate_limited'
      ? MANIFEST_MAX_UNPRODUCTIVE_RATE_LIMITED
      : MANIFEST_MAX_UNPRODUCTIVE_OTHER;
  if (attemptCount >= maxAttempts) return { retry: false, reason: 'attempts' };

  let delayMs = getManifestSyncRetryDelayMs({
    retryAfter: d.retryAfter,
    attemptCount: d.madeProgress ? 0 : d.attemptCount,
    error: d.error,
    now
  });
  if (now + delayMs - d.createdAt.getTime() >= MANIFEST_SYNC_LIFETIME_MS) {
    return { retry: false, reason: 'lifetime' };
  }

  return { retry: true, attemptCount, delayMs };
};

// lastPushedCommitSha only ever holds a commit Origin wrote itself (or the branch's starting
// point). A run that started from any other head, or saw the head move under it, means someone
// else committed to the branch, which rules out resetting it until Origin starts a new branch.
export let getBranchLineageUpdate = (
  sync: Pick<ScmRepositorySync, 'lastPushedCommitSha' | 'foreignCommitsOnBranch'>,
  lineage: ExportLineage | null | undefined
) => ({
  lastPushedCommitSha: lineage?.lastCommitSha ?? sync.lastPushedCommitSha,
  foreignCommitsOnBranch:
    sync.foreignCommitsOnBranch ||
    (!!lineage?.startHeadSha &&
      (lineage.foreignCommits || lineage.startHeadSha !== sync.lastPushedCommitSha))
});

export let logRepositorySyncQueueEvent = (
  stage: string,
  message: string,
  d: Record<string, unknown>
) => {
  console.log(
    JSON.stringify({
      event: 'repository_sync_queue',
      level: 'info',
      stage,
      message,
      ...d
    })
  );
};

export let logRepositorySyncQueueError = (
  stage: string,
  message: string,
  error: unknown,
  d: Record<string, unknown>
) => {
  console.error(
    JSON.stringify({
      event: 'repository_sync_queue',
      level: 'error',
      stage,
      message,
      ...d,
      providerDiagnostic: getScmProviderLogDetails(error)
    })
  );
};

export let appendRepositorySyncLog = async (syncId: string, message: string) => {
  await db.scmRepositorySync.updateMany({
    where: { id: syncId },
    data: {
      logs: {
        push: [Date.now(), message] satisfies RepositorySyncLogEntry
      }
    }
  });
};

let stripLowerdeckErrorPrefix = (message: string) =>
  message.replace(/^\[@lowerdeck\/error\]:\s*/, '').trim();

let toPublicErrorMessage = (message: string) =>
  toPublicProviderErrorMessage(stripLowerdeckErrorPrefix(message));

export let getRepositorySyncErrorMessage = (error: unknown) => {
  let dataMessage = (error as any)?.data?.message;
  if (typeof dataMessage === 'string' && dataMessage.trim()) {
    return toPublicErrorMessage(dataMessage);
  }

  let message = error instanceof Error ? error.message : String(error);
  let serialized = message.match(/\s+\((\{.*\})\)\s*$/s)?.[1];
  if (serialized) {
    try {
      let parsed = JSON.parse(serialized);
      if (typeof parsed?.message === 'string' && parsed.message.trim()) {
        return toPublicErrorMessage(parsed.message);
      }
    } catch {
      // Keep the original message when the suffix is not lowerdeck error metadata.
    }
  }

  return toPublicErrorMessage(message.replace(/\s+\(\{.*\}\)\s*$/s, ''));
};

export let markRepositorySyncFailed = async (syncId: string, error: unknown) => {
  let sync = await db.scmRepositorySync.findUnique({ where: { id: syncId } });
  if (!sync || isTerminalRepositorySyncStatus(sync.status)) return;
  let details = getScmProviderErrorDetails(error);
  let message =
    sync.repositoryAccessMode === 'default_branch'
      ? details.classification === 'protected_branch'
        ? 'Direct push was blocked by repository rules. Use pull requests or allow writes to the default branch.'
        : ['permission_denied', 'authentication_failed'].includes(details.classification)
          ? 'The connected account cannot push to the default branch. Update repository access and retry.'
          : details.classification === 'conflict'
            ? 'The default branch changed while syncing. Retry the sync.'
            : ['rate_limited', 'timeout', 'upstream_failure', 'network_failure'].includes(
                  details.classification
                )
              ? 'The repository provider could not complete the update. Retry the sync.'
              : getRepositorySyncErrorMessage(error)
      : getRepositorySyncErrorMessage(error);
  let updated = await transitionRepositorySyncState(syncId, sync.status, {
    status: 'failed',
    errorMessage: message,
    completedAt: new Date(),
    attemptCount: { increment: 1 },
    nextPollAt: null,
    logs: {
      push: [Date.now(), 'Repository update failed.'] satisfies RepositorySyncLogEntry
    }
  });
  if (updated) {
    reportRepositorySyncFailure({
      sync,
      errorCode: details.exportErrorCode ?? details.classification,
      errorMessage: message,
      error
    });
  }
};

let dismissalMessages: Record<RepositorySyncDismissal, string> = {
  pull_request_closed: 'Pull request was closed before it could be merged',
  pull_request_deleted: 'Pull request was deleted before it could be merged',
  branch_deleted: 'The update branch was deleted before the update finished'
};

export let endDismissedRepositorySync = async (
  sync: { id: string; status: ScmRepositorySyncStatus },
  endReason: RepositorySyncDismissal,
  data: Prisma.ScmRepositorySyncUncheckedUpdateManyInput = {}
) => {
  let updated = await transitionRepositorySyncState(sync.id, sync.status, {
    ...data,
    status: 'cancelled',
    endReason,
    errorMessage: dismissalMessages[endReason],
    waitingReason: null,
    nextPollAt: null,
    completedAt: new Date()
  });
  if (updated) await appendRepositorySyncLog(sync.id, `${dismissalMessages[endReason]}.`);
  return updated;
};
