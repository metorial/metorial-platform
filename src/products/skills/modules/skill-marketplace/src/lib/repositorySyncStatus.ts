export type RepositoryAccessMode = 'pull_request' | 'default_branch';

export let isRepositorySyncRetrying = (sync: {
  errorMessage?: string | null;
  nextPollAt?: unknown;
}) => Boolean(sync.errorMessage && sync.nextPollAt);

export let getRepositorySyncRetryMessage = (
  mode: RepositoryAccessMode,
  errorCode?: string | null
) => {
  if (errorCode === 'merge_not_ready')
    return "The repository isn't ready to merge yet. The sync will retry automatically.";
  if (errorCode === 'rate_limited')
    return 'The repository is limiting requests. The sync will retry automatically.';
  if (errorCode === 'authentication_failed')
    return 'The repository connection needs attention. Reconnect it if the sync does not resume.';
  if (errorCode === 'permission_denied' || errorCode === 'protected_branch')
    return 'Repository access is blocking the sync. Check connection permissions and branch rules.';

  return mode === 'default_branch'
    ? `We couldn't update the default branch. We'll retry automatically.`
    : `We couldn't update the pull request. We'll retry automatically.`;
};
