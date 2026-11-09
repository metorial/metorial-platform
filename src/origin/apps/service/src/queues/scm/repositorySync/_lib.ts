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
  isTerminalRepositorySyncStatus,
  transitionRepositorySyncState
} from '../../../services/repositorySyncState';

export let MANIFEST_SYNC_LIFETIME_MS = 48 * 60 * 60_000;
let MANIFEST_MAX_RETRY_DELAY_MS = 60 * 60_000;
let MANIFEST_RETRY_JITTER_MS = 30_000;
let MANIFEST_MAX_UNPRODUCTIVE_RATE_LIMITED = 6;
let MANIFEST_MAX_UNPRODUCTIVE_OTHER = 3;

export type RepositorySyncLogEntry = [number, string];

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
  await transitionRepositorySyncState(syncId, sync.status, {
    status: 'failed',
    errorMessage: message,
    completedAt: new Date(),
    attemptCount: { increment: 1 },
    nextPollAt: null,
    logs: {
      push: [Date.now(), 'Repository update failed.'] satisfies RepositorySyncLogEntry
    }
  });
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
