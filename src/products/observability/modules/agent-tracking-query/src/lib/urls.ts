import { ticketUrlTemplateKey } from '@metorial/module-agent-tracking-sync';
import type { AgentTrackingRepository } from './types';

type RepositoryShape = 'github' | 'gitlab' | 'bitbucket';

let providerHosts = new Map([
  ['github', 'github.com'],
  ['gitlab', 'gitlab.com'],
  ['bitbucket', 'bitbucket.org']
]);

let publicHosts = [...providerHosts.values()];

let pullRequestPaths: Record<RepositoryShape, string> = {
  github: 'pull',
  gitlab: '-/merge_requests',
  bitbucket: 'pull-requests'
};

let maxSegmentLength = 128;

let maxOwnerSegments = 8;

let hostPattern =
  /^(?=.{4,128}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

// Browsers read a host whose last label is a number (`127.1`, `0x7f.0.0.1`) as an IP address.
let numericHostPattern = /(?:^|\.)(?:[0-9]+|0x[0-9a-f]*)$/;

let localHostPattern = /(?:^|\.)(?:localhost|local|internal)$/;

let punycodePattern = /(?:^|\.)xn--/;

let githubHostPattern = /(?:^|\.)github\./;

let gitlabHostPattern = /(?:^|\.)gitlab\./;

let segmentPattern = /^[A-Za-z0-9_.~-]+$/;

let issueRefPattern = /^#([1-9][0-9]{0,8})$/;

let isSegment = (segment: string) =>
  segment.length <= maxSegmentLength &&
  segmentPattern.test(segment) &&
  segment != '.' &&
  segment != '..';

let pathOf = (owner: string, name: string, maxOwners: number) => {
  let owners = owner.split('/');
  if (owners.length > maxOwners || ![...owners, name].every(isSegment)) return null;

  return `${owner}/${name}`;
};

let hostShape = (host: string): RepositoryShape | null =>
  githubHostPattern.test(host) ? 'github' : gitlabHostPattern.test(host) ? 'gitlab' : null;

let shapeOf = (host: string) => (host == 'bitbucket.org' ? 'bitbucket' : hostShape(host));

let isLinkableHost = (host: string) =>
  !numericHostPattern.test(host) &&
  !localHostPattern.test(host) &&
  !punycodePattern.test(host);

export let splitRepository = (repository: string) => {
  let slash = repository.lastIndexOf('/');
  if (slash <= 0 || slash == repository.length - 1) return null;

  return { owner: repository.slice(0, slash), name: repository.slice(slash + 1) };
};

export let repositoryHost = (provider: string | null | undefined) => {
  let value = provider?.trim().toLowerCase();
  if (!value) return null;

  let host = providerHosts.get(value) ?? value;
  return hostPattern.test(host) ? host : null;
};

export let repositoryUrl = (repository: {
  provider: string | null;
  owner: string | null;
  name: string | null;
}) => {
  let host = repositoryHost(repository.provider);
  if (!host || !isLinkableHost(host) || !repository.owner || !repository.name) return null;

  let path = pathOf(repository.owner, repository.name, maxOwnerSegments);
  return path ? `https://${host}/${path}` : null;
};

export let pullRequestUrl = (
  pullRequest: { provider: string; repository: string; number: number },
  repositories: Pick<AgentTrackingRepository, 'provider'>[] = []
) => {
  if (!Number.isSafeInteger(pullRequest.number) || pullRequest.number <= 0) return null;

  let host = repositoryHost(pullRequest.provider);
  let trusted =
    !!host &&
    (publicHosts.includes(host) ||
      repositories.some(repository => repositoryHost(repository.provider) == host));
  let shape = host ? shapeOf(host) : null;
  if (!host || !trusted || !shape || !isLinkableHost(host)) return null;

  let parts = splitRepository(pullRequest.repository);
  let path = parts
    ? pathOf(parts.owner, parts.name, shape == 'gitlab' ? maxOwnerSegments : 1)
    : null;
  if (!path) return null;

  return `https://${host}/${path}/${pullRequestPaths[shape]}/${pullRequest.number}`;
};

export let ticketUrl = (
  key: string,
  d: {
    template: string | null;
    repositories: Pick<AgentTrackingRepository, 'provider' | 'owner' | 'name'>[];
  }
) => {
  let issue = issueRefPattern.exec(key);
  if (!issue) {
    return d.template
      ? d.template.replaceAll(ticketUrlTemplateKey, encodeURIComponent(key))
      : null;
  }

  let [repository] = d.repositories;
  if (d.repositories.length != 1 || !repository) return null;

  let host = repositoryHost(repository.provider);
  let base = repositoryUrl(repository);
  if (!host || !base || !hostShape(host)) return null;

  return `${base}/issues/${issue[1]}`;
};

export let ticketsOf = (
  keys: string[],
  d: Parameters<typeof ticketUrl>[1]
): { key: string; url: string | null }[] => keys.map(key => ({ key, url: ticketUrl(key, d) }));
