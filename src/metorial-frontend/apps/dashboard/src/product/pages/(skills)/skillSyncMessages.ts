type RepositoryProvider = 'github' | 'gitlab' | 'bitbucket';

export type RepositoryActionMessageInput = {
  provider: RepositoryProvider | null;
  repositoryAccessMode: 'pull_request' | 'default_branch';
  overrideAttemptStatus: 'not_attempted' | 'attempting' | 'refused' | 'waiting' | 'succeeded';
  mergeBeforeChecksPass: boolean;
  blockers: string[];
  targetBranch: string | null;
  errorMessage: string | null;
  reviewStatus: string | null;
  requiredReviewCount: number | null;
  approvedReviewCount: number | null;
};

export type PropagationErrorInput = {
  provider: RepositoryProvider | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  unexpectedDeleteCount?: number | null;
};

export type PropagationNoticeInput = {
  provider: RepositoryProvider | null;
  waitingUntil?: Date | null;
  waitingReason?: string | null;
  endReason?:
    'superseded' | 'pull_request_closed' | 'pull_request_deleted' | 'branch_deleted' | null;
};

let getProviderName = (repositoryCheck: { provider: RepositoryProvider | null }) => {
  if (repositoryCheck.provider === 'github') return 'GitHub';
  if (repositoryCheck.provider === 'gitlab') return 'GitLab';
  if (repositoryCheck.provider === 'bitbucket') return 'Bitbucket';
  return 'Repository provider';
};

let getPullRequestName = (repositoryCheck: { provider: RepositoryProvider | null }) =>
  repositoryCheck.provider === 'gitlab' ? 'merge request' : 'pull request';

let formatFileCount = (count: number) => `${count} ${count === 1 ? 'file' : 'files'}`;

export let getForceSyncLabel = (unexpectedDeleteCount: number | null) =>
  unexpectedDeleteCount
    ? `Sync anyway and delete ${formatFileCount(unexpectedDeleteCount)}`
    : 'Sync anyway and delete files';

let capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export let formatResumeTime = (date: Date, now = new Date()) => {
  let time = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
  if (date.toDateString() === now.toDateString()) return time;

  let day = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    date
  );
  return `${day}, ${time}`;
};

export let getPropagationWaitingMessage = (
  propagation: PropagationNoticeInput,
  now = new Date()
) => {
  if (!propagation.waitingUntil) return null;

  let resumesAt = formatResumeTime(new Date(propagation.waitingUntil), now);
  if (propagation.waitingReason === 'rate_limited') {
    let providerName = propagation.provider ? getProviderName(propagation) : 'provider';
    return `Waiting for ${providerName} rate limit, resumes at ${resumesAt}`;
  }
  if (propagation.waitingReason === 'provider_unavailable') {
    return `${getProviderName(propagation)} is temporarily unavailable, retrying at ${resumesAt}`;
  }
  return `Waiting to continue, resumes at ${resumesAt}`;
};

export let getPropagationErrorMessage = (propagation: PropagationErrorInput) => {
  let providerName = getProviderName(propagation);

  switch (propagation.errorCode) {
    case 'path_conflict':
      return `A path in the ${providerName} repository is in the way of a synced file. Move or remove it there, then sync again.`;
    case 'destination_too_large':
      return 'This marketplace is too large to sync to a repository. Remove skills or files, then sync again.';
    case 'file_too_large':
      return `A synced file is too large for ${providerName}. Remove or shrink it, then sync again.`;
    case 'lfs_quota_exceeded':
      return `The repository's ${providerName} Git LFS quota is used up. Increase the quota or remove large files, then sync again.`;
    case 'deletion_guard_tripped':
      return propagation.unexpectedDeleteCount
        ? `This sync would delete ${formatFileCount(propagation.unexpectedDeleteCount)} Metorial didn't expect in the repository. Review the repository, then sync anyway to delete them.`
        : "This sync would delete files Metorial didn't expect in the repository. Review the repository, then sync anyway to delete them.";
    case 'tree_too_large':
      return `The ${providerName} repository has too many folders for Metorial to compare. Sync into a smaller repository or remove unrelated folders from it, then sync again.`;
    case 'content_mismatch':
      return "Some stored files didn't match their recorded content. Metorial rebuilds them and retries automatically.";
    case 'recovery_exhausted':
      return 'Metorial kept failing to rebuild missing or damaged files and stopped retrying. Edit or re-save the affected skills, then sync again.';
    case 'no_progress':
      return 'Sync stopped making progress; Metorial will retry.';
  }

  return propagation.errorMessage ?? null;
};

export let getPropagationDismissalMessage = (propagation: PropagationNoticeInput) => {
  let providerName = propagation.provider ? getProviderName(propagation) : 'the repository';
  let pullRequestName = getPullRequestName(propagation);
  let nextChange = `Metorial won't reopen it. The next change opens a new ${pullRequestName}.`;

  if (propagation.endReason === 'pull_request_closed') {
    return `${capitalize(pullRequestName)} was closed in ${providerName}. ${nextChange}`;
  }
  if (propagation.endReason === 'pull_request_deleted') {
    return `${capitalize(pullRequestName)} was deleted in ${providerName}. ${nextChange}`;
  }
  if (propagation.endReason === 'branch_deleted') {
    return `Branch was deleted in ${providerName}. ${nextChange}`;
  }
  return null;
};

export let getRepositoryActionMessage = (repositoryCheck: RepositoryActionMessageInput) => {
  let providerName = getProviderName(repositoryCheck);
  let pullRequestName = getPullRequestName(repositoryCheck);
  if (repositoryCheck.overrideAttemptStatus === 'attempting') {
    return repositoryCheck.mergeBeforeChecksPass &&
      repositoryCheck.blockers.includes('checks_pending')
      ? 'Trying to merge before checks finish.'
      : repositoryCheck.repositoryAccessMode === 'default_branch'
        ? 'Trying an override push.'
        : 'Trying an override merge.';
  }
  if (repositoryCheck.overrideAttemptStatus === 'refused') {
    return `${providerName} blocked ${
      repositoryCheck.repositoryAccessMode === 'default_branch' ? 'the push' : 'the merge'
    }. Review repository rules.`;
  }
  if (repositoryCheck.repositoryAccessMode === 'default_branch') {
    if (repositoryCheck.errorMessage) return repositoryCheck.errorMessage;
    if (repositoryCheck.blockers.includes('provider_unavailable')) {
      return `${providerName} is temporarily unavailable. The sync will continue automatically.`;
    }
    return `${providerName} blocked the push to ${
      repositoryCheck.targetBranch ?? 'the default branch'
    }. Check branch rules and connection permissions.`;
  }
  let checksFailed = repositoryCheck.blockers.includes('checks_failed');
  let reviewRequired = repositoryCheck.blockers.includes('reviews_required');
  let reviewCount =
    repositoryCheck.requiredReviewCount != null &&
    repositoryCheck.requiredReviewCount > 0 &&
    repositoryCheck.approvedReviewCount != null
      ? ` (${repositoryCheck.approvedReviewCount}/${repositoryCheck.requiredReviewCount} approvals)`
      : '';
  let reviewMessage =
    repositoryCheck.reviewStatus === 'changes_requested'
      ? `Changes requested. Update the ${pullRequestName} to continue.`
      : `Review required${reviewCount}.`;
  if (checksFailed && reviewRequired) {
    return repositoryCheck.reviewStatus === 'changes_requested'
      ? 'Checks failed and changes were requested.'
      : `Checks failed and review is required${reviewCount}.`;
  }
  if (checksFailed) return 'Checks failed. Fix or rerun them to continue.';
  if (reviewRequired) return reviewMessage;
  if (repositoryCheck.blockers.includes('merge_conflict')) {
    return `The ${providerName} ${pullRequestName} has conflicts. Resolve them to continue.`;
  }
  if (repositoryCheck.blockers.includes('merge_permission_required')) {
    return `The connected ${providerName} account can't merge into this branch. Grant merge access to continue.`;
  }
  if (repositoryCheck.blockers.includes('merge_blocked')) {
    return `${providerName} repository rules are blocking this ${pullRequestName}.`;
  }
  if (repositoryCheck.blockers.includes('provider_unavailable')) {
    return `${providerName} is temporarily unavailable. The sync will continue automatically.`;
  }
  return repositoryCheck.errorMessage ?? 'Repository action is required to continue.';
};
