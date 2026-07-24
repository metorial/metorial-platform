export type RepositoryActionMessageInput = {
  provider: 'github' | 'gitlab' | 'bitbucket' | null;
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

let getProviderName = (repositoryCheck: RepositoryActionMessageInput) => {
  if (repositoryCheck.provider === 'github') return 'GitHub';
  if (repositoryCheck.provider === 'gitlab') return 'GitLab';
  if (repositoryCheck.provider === 'bitbucket') return 'Bitbucket';
  return 'Repository provider';
};

let getPullRequestName = (repositoryCheck: RepositoryActionMessageInput) =>
  repositoryCheck.provider === 'gitlab' ? 'merge request' : 'pull request';

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
