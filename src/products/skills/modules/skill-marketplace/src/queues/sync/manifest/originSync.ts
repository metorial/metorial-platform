export let dismissalEndReasons = [
  'pull_request_closed',
  'pull_request_deleted',
  'branch_deleted'
] as const;

export let retryableManifestErrorCodes = [
  'rate_limited',
  'lease_expired',
  'source_not_found',
  'content_mismatch',
  'sync_timeout',
  'sync_lifetime_exceeded',
  'no_progress',
  'timeout',
  'conflict',
  'upstream_failure',
  'network_failure',
  'provider_unavailable',
  'manifest_sync_disabled'
] as const;

export let userActionableManifestErrorCodes = [
  'destination_too_large',
  'file_too_large',
  'lfs_quota_exceeded',
  'path_conflict',
  'tree_too_large',
  'recovery_exhausted'
] as const;

let completedStatuses = [
  'merged',
  'complete_unmerged',
  'complete_direct_push',
  'complete_no_changes'
] as const;

let baseBranchStatuses = ['merged', 'complete_direct_push', 'complete_no_changes'];

export type ManifestOriginSync = {
  id: string;
  status: string;
  branchName?: string | null;
  providerPrUrl?: string | null;
  errorMessage?: string | null;
  errorCode?: string | null;
  errorDetails?: {
    paths?: string[];
    keys?: string[];
    key?: string;
    total?: number;
    unexpectedDeletes?: number;
    path?: string;
  } | null;
  endReason?: string | null;
  waitingReason?: string | null;
  waitingUntil?: Date | string | null;
  nextPollAt?: Date | string | null;
  resultStats?: Record<string, number> | null;
};

export type ManifestPropagationOutcome =
  | { type: 'completed'; onBaseBranch: boolean }
  | { type: 'failed'; errorCode: string; errorMessage: string }
  | { type: 'canceled'; endReason: string | null; dismissed: boolean }
  | {
      type: 'active';
      status: 'processing' | 'waiting_for_review';
      waitingUntil: Date | null;
      waitingReason: string | null;
    };

export let isRetryableManifestErrorCode = (code: string | null | undefined) =>
  !!code && (retryableManifestErrorCodes as readonly string[]).includes(code);

export let isDismissalEndReason = (reason: string | null | undefined) =>
  !!reason && (dismissalEndReasons as readonly string[]).includes(reason);

export let getManifestErrorMessage = (d: {
  errorCode: string;
  originMessage?: string | null;
  details?: ManifestOriginSync['errorDetails'];
}) => {
  let count = d.details?.unexpectedDeletes ?? d.details?.total ?? d.details?.paths?.length;

  switch (d.errorCode) {
    case 'deletion_guard_tripped':
      return `Sync would delete ${count ?? 'many'} file${count === 1 ? '' : 's'} Metorial didn't expect; review and force the sync to continue.`;
    case 'destination_too_large':
      return 'This destination is too large to sync to a repository. Remove skills or files, then sync again.';
    case 'file_too_large':
      return `${d.details?.path ? `${d.details.path} is` : 'A file is'} too large for the repository provider. Remove or shrink it, then sync again.`;
    case 'lfs_quota_exceeded':
      return "The repository's Git LFS storage quota is exhausted. Increase the quota or remove large files, then sync again.";
    case 'path_conflict': {
      let blocking = d.details?.paths?.[0];
      return `${d.details?.path ?? 'A file'} can't be written because ${
        blocking && blocking !== d.details?.path ? blocking : 'a path'
      } in the repository is in the way. Move or remove it there, then sync again.`;
    }
    case 'manifest_sync_disabled':
      return 'Repository updates are paused by the repository service. Metorial retries automatically.';
    case 'manifest_invalid':
      return 'Metorial produced an invalid sync manifest. This is a bug on our side; it will not be retried automatically.';
    case 'source_not_found':
      return 'Some files were missing from storage. Metorial rebuilds them and retries automatically.';
    case 'content_mismatch':
      return "Some stored files didn't match their recorded content. Metorial rebuilds them and retries automatically.";
    case 'recovery_exhausted':
      return 'Metorial kept failing to rebuild missing or damaged files and stopped retrying. Edit or re-save the affected skills, then sync again.';
    case 'tree_too_large':
      return 'The repository has too many folders for Metorial to compare. Sync into a smaller repository or remove unrelated folders from it, then sync again.';
    case 'rate_limited':
      return 'The repository provider kept rate limiting this update. Metorial retries automatically.';
    case 'sync_timeout':
    case 'sync_lifetime_exceeded':
      return 'The repository update took too long. Metorial retries automatically.';
    case 'no_progress':
      return 'Sync stopped making progress; Metorial will retry.';
  }

  return d.originMessage ?? 'Repository update failed.';
};

let notWaiting = { waitingUntil: null, waitingReason: null };

export let getOriginWaitingState = (
  originSync: ManifestOriginSync
): { waitingUntil: Date | null; waitingReason: string | null } => {
  if (originSync.status !== 'syncing_contents') {
    if (
      ['creating_pr', 'waiting_for_ci', 'waiting_for_review', 'merging'].includes(
        originSync.status
      ) &&
      originSync.errorMessage &&
      originSync.nextPollAt
    ) {
      return {
        waitingUntil: new Date(originSync.nextPollAt),
        waitingReason: originSync.errorCode ?? 'sync_retrying'
      };
    }
    return notWaiting;
  }

  if (originSync.waitingReason !== undefined) {
    let until = originSync.waitingUntil ?? originSync.nextPollAt;
    if (!originSync.waitingReason || !until) return notWaiting;
    return { waitingUntil: new Date(until), waitingReason: originSync.waitingReason };
  }

  // Origin versions without waitingReason only expose the retry as nextPollAt plus an error.
  if (!originSync.nextPollAt || !(originSync.errorCode || originSync.errorMessage)) {
    return notWaiting;
  }
  return {
    waitingUntil: new Date(originSync.nextPollAt),
    waitingReason:
      originSync.errorCode ??
      (/rate.?limit/i.test(originSync.errorMessage ?? '')
        ? 'rate_limited'
        : 'provider_unavailable')
  };
};

export let resolveManifestPropagationOutcome = (d: {
  originSync: ManifestOriginSync;
  repositoryAccessMode: 'pull_request' | 'default_branch';
  startedAt: Date | null;
  now: Date;
  maxLifetimeMs: number;
}): ManifestPropagationOutcome => {
  let { originSync } = d;

  if ((completedStatuses as readonly string[]).includes(originSync.status)) {
    return { type: 'completed', onBaseBranch: baseBranchStatuses.includes(originSync.status) };
  }

  if (originSync.status === 'failed') {
    let errorCode = originSync.errorCode ?? 'origin_failed';
    return {
      type: 'failed',
      errorCode,
      errorMessage: getManifestErrorMessage({
        errorCode,
        originMessage: originSync.errorMessage,
        details: originSync.errorDetails
      })
    };
  }

  if (originSync.status === 'cancelled') {
    return {
      type: 'canceled',
      endReason: originSync.endReason ?? null,
      dismissed: isDismissalEndReason(originSync.endReason)
    };
  }

  let status =
    d.repositoryAccessMode === 'pull_request' && originSync.status === 'waiting_for_review'
      ? ('waiting_for_review' as const)
      : ('processing' as const);
  let { waitingUntil, waitingReason } = getOriginWaitingState(originSync);

  if (
    status === 'processing' &&
    d.startedAt &&
    d.now.getTime() - d.startedAt.getTime() > d.maxLifetimeMs
  ) {
    let errorCode = waitingReason === 'rate_limited' ? 'rate_limited' : 'sync_timeout';
    return { type: 'failed', errorCode, errorMessage: getManifestErrorMessage({ errorCode }) };
  }

  return { type: 'active', status, waitingUntil, waitingReason };
};

export let summarizeResultStats = (stats: Record<string, number> | null | undefined) => {
  if (!stats) return null;

  let parts = [
    stats.filesUploaded ? `${stats.filesUploaded} uploaded` : null,
    stats.filesSkipped ? `${stats.filesSkipped} unchanged` : null,
    stats.deleted ? `${stats.deleted} deleted` : null,
    stats.commitsCreated
      ? `${stats.commitsCreated} commit${stats.commitsCreated === 1 ? '' : 's'}`
      : null,
    stats.rateLimitWaitMs
      ? `waited ${Math.round(stats.rateLimitWaitMs / 1000)}s for rate limits`
      : null
  ].filter(Boolean);

  return parts.length ? parts.join(', ') : null;
};
