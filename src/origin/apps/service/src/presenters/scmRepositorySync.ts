import type { ScmRepositorySync } from '../../prisma/generated/client';
import type { RepositorySyncStatusSnapshot } from '../services/repositorySyncState';

let getMergeAttemptDetails = (sync: ScmRepositorySync) => {
  let snapshot = sync.statusSnapshot as RepositorySyncStatusSnapshot | null;
  if (sync.repositoryAccessMode === 'default_branch') {
    if (!sync.forceMergeOrPush) {
      return { status: 'not_attempted' as const, refusalReason: null };
    }
    let status =
      sync.status === 'complete_direct_push' || sync.status === 'complete_no_changes'
        ? ('succeeded' as const)
        : sync.status === 'failed'
          ? ('refused' as const)
          : sync.status === 'creating_branch' || sync.status === 'syncing_contents'
            ? ('attempting' as const)
            : ('waiting' as const);
    return { status, refusalReason: null };
  }

  let isPolicyAttempt = Boolean(
    snapshot &&
    ((sync.mergeBeforeChecksPass &&
      (snapshot.checks.state === 'pending' || snapshot.checks.state === 'unknown')) ||
      (sync.forceMergeOrPush &&
        (snapshot.checks.state === 'failed' ||
          snapshot.review.state === 'pending' ||
          snapshot.review.state === 'changes_requested' ||
          snapshot.mergeability.state === 'blocked')))
  );
  if (!isPolicyAttempt) {
    return { status: 'not_attempted' as const, refusalReason: null };
  }

  let refusalReason =
    snapshot?.mergeability.reason === 'merge_permission_required' ||
    snapshot?.mergeability.reason === 'merge_rejected'
      ? snapshot.mergeability.reason
      : null;
  let status =
    sync.status === 'merged'
      ? ('succeeded' as const)
      : refusalReason && sync.mergeAttemptSnapshotHashes.length > 0
        ? ('refused' as const)
        : sync.status === 'merging'
          ? ('attempting' as const)
          : (sync.forceMergeOrPush || sync.mergeBeforeChecksPass) &&
              ['waiting_for_ci', 'waiting_for_review'].includes(sync.status)
            ? ('waiting' as const)
            : ('not_attempted' as const);

  return { status, refusalReason };
};

export let scmRepositorySyncPresenter = (sync: ScmRepositorySync) => {
  let mergeAttempt = getMergeAttemptDetails(sync);

  return {
    object: 'origin#repository_sync' as const,

    id: sync.id,
    status: sync.status,
    repositoryAccessMode: sync.repositoryAccessMode,

    branchName: sync.branchName,
    baseBranch: sync.baseBranch,

    title: sync.title,
    description: sync.description,
    enableAutoMerge: sync.enableAutoMerge,
    forceMergeOrPush: sync.forceMergeOrPush,
    mergeBeforeChecksPass: sync.mergeBeforeChecksPass,
    mergeAttemptStatus: mergeAttempt.status,
    mergeAttemptRefusalReason: mergeAttempt.refusalReason,

    providerPrId: sync.providerPrId,
    providerPrUrl: sync.providerPrUrl,
    providerMergeSha: sync.providerMergeSha,

    errorMessage: sync.errorMessage,
    ciState: sync.ciState,
    statusSnapshot: sync.statusSnapshot as RepositorySyncStatusSnapshot | null,
    attemptCount: sync.attemptCount,
    logs: sync.logs,

    lastPolledAt: sync.lastPolledAt,
    nextPollAt: sync.nextPollAt,
    completedAt: sync.completedAt,

    createdAt: sync.createdAt,
    updatedAt: sync.updatedAt
  };
};
