export type RepositoryAccessMode = 'pull_request' | 'default_branch';

export let isRepositorySyncRetrying = (sync: {
  errorMessage?: string | null;
  nextPollAt?: unknown;
}) => Boolean(sync.errorMessage && sync.nextPollAt);

export let getRepositorySyncRetryMessage = (mode: RepositoryAccessMode) =>
  mode === 'default_branch'
    ? `We couldn't update the default branch. We'll retry automatically.`
    : `We couldn't update the pull request. We'll retry automatically.`;
