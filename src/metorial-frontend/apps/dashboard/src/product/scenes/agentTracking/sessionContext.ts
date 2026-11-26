import { formatNumber } from '@metorial/chart';
import type { DashboardInstanceAgentTrackingSessionsGetOutput } from '@metorial/dashboard-sdk';
import { isHttpUrl } from '../../lib/isHttpUrl';
import { unknownRepositoryLabel } from './spendSummary';

type SessionContext = DashboardInstanceAgentTrackingSessionsGetOutput['context'];

type Repository = Pick<SessionContext['repositories'][number], 'host' | 'owner' | 'name'>;

let shortShaLength = 7;

let publicGitHosts = new Set(['github.com', 'gitlab.com', 'bitbucket.org']);

export let pullRequestKindLabels = { opened: 'Opened', linked: 'Linked' } as const;

export let shortSha = (sha: string) => sha.slice(0, shortShaLength);

export let linkableUrl = (url: string | null | undefined) =>
  url && isHttpUrl(url) ? url : null;

export let withHost = (host: string | null, path: string) =>
  host && !publicGitHosts.has(host) ? `${host}/${path}` : path;

export let repositoryLabel = (repository: Repository) => {
  let path =
    repository.owner && repository.name
      ? `${repository.owner}/${repository.name}`
      : repository.name;

  return path ? withHost(repository.host, path) : unknownRepositoryLabel;
};

export let pullRequestLabel = (pullRequest: {
  host: string | null;
  repository: string;
  number: number;
}) => withHost(pullRequest.host, `${pullRequest.repository}#${pullRequest.number}`);

export let otherDefaultBranch = (context: Pick<SessionContext, 'branch' | 'defaultBranch'>) =>
  context.defaultBranch && context.defaultBranch != context.branch
    ? context.defaultBranch
    : null;

export let worktreeLabel = (worktree: boolean | null) =>
  worktree === null ? null : worktree ? 'Linked Worktree' : 'Main Checkout';

export let linesChangedLabel = (lines: SessionContext['lines']) =>
  lines.added || lines.removed
    ? `+${formatNumber(lines.added)} −${formatNumber(lines.removed)}`
    : null;
