import type { SkillMarketplaceRepository, SkillSync } from '@metorial/state';
import { shleemy } from 'shleemy';
import { getPropagationWaitingMessage } from '../skillSyncMessages';

type RepositoryPropagation = SkillSync['repositoryPropagations'][number];

let activePropagationStatuses = ['pending', 'processing', 'waiting_for_review'];

let getRepositoryName = (repository: SkillMarketplaceRepository) => {
  let url = repository.repository.url;
  if (url) {
    try {
      let path = new URL(url).pathname.replace(/^\/+|\/+$/g, '').replace(/\.git$/, '');
      if (path) return path;
    } catch {}
  }
  return repository.repository.name || repository.repoId;
};

let formatRepositoryNames = (repositories: SkillMarketplaceRepository[]) =>
  new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(
    repositories.map(getRepositoryName)
  );

let describeRepositories = (repositories: SkillMarketplaceRepository[]) =>
  `The skill ${repositories.length === 1 ? 'repository' : 'repositories'} ${formatRepositoryNames(repositories)}`;

let isOrAre = (repositories: SkillMarketplaceRepository[]) =>
  repositories.length === 1 ? 'is' : 'are';

let isWaiting = (propagation: RepositoryPropagation) =>
  Boolean(propagation.waitingUntil) &&
  !propagation.endReason &&
  activePropagationStatuses.includes(propagation.status);

let getWaitingMessage = (
  propagation: RepositoryPropagation,
  repositories: SkillMarketplaceRepository[]
) => {
  let repository = repositories.find(repository => repository.repoId === propagation.repoId);
  return getPropagationWaitingMessage({
    ...propagation,
    provider: repository?.repository.provider ?? null
  });
};

let getProcessingMessage = (sync: SkillSync, repositories: SkillMarketplaceRepository[]) => {
  let syncing = `${describeRepositories(repositories)} ${isOrAre(repositories)} syncing now.`;

  let waiting = sync.repositoryPropagations.filter(isWaiting);
  let waitingRepoIds = new Set(waiting.map(propagation => propagation.repoId));
  let waitingRepositories = repositories.filter(repository =>
    waitingRepoIds.has(repository.repoId)
  );
  let waitingPropagation = waiting.find(propagation =>
    waitingRepositories.some(repository => repository.repoId === propagation.repoId)
  );
  let waitingMessage = waitingPropagation
    ? getWaitingMessage(waitingPropagation, repositories)
    : null;
  if (!waitingMessage) return syncing;

  let paused = `${isOrAre(waitingRepositories)} paused. ${waitingMessage}.`;
  let syncingRepositories = repositories.filter(
    repository => !waitingRepoIds.has(repository.repoId)
  );
  if (!syncingRepositories.length) return `${describeRepositories(repositories)} ${paused}`;

  return `${describeRepositories(syncingRepositories)} ${isOrAre(syncingRepositories)} syncing now. ${formatRepositoryNames(waitingRepositories)} ${paused}`;
};

export let getSyncStatusMessage = (
  sync: SkillSync,
  repositories: SkillMarketplaceRepository[]
) => {
  let propagationRepositoryIds = new Set(
    sync.repositoryPropagations.map(propagation => propagation.repoId)
  );
  let syncedRepositories = repositories.filter(repository =>
    propagationRepositoryIds.has(repository.repoId)
  );
  let relevantRepositories = syncedRepositories.length ? syncedRepositories : repositories;
  let subject = describeRepositories(relevantRepositories);
  let isSingle = relevantRepositories.length === 1;
  let occurredAt = sync.completedAt ?? sync.startedAt ?? sync.createdAt;
  let relativeTime = shleemy(new Date(occurredAt)).forHumans;

  if (sync.status === 'completed') {
    return `${subject} ${isSingle ? 'was' : 'were'} synced successfully ${relativeTime}.`;
  }
  if (sync.status === 'processing') {
    return getProcessingMessage(sync, relevantRepositories);
  }
  if (sync.status === 'waiting_for_review') {
    return `${subject} ${isSingle ? 'needs' : 'need'} your attention before syncing can continue.`;
  }
  if (sync.status === 'failed') {
    return `${subject} failed to sync ${relativeTime}.`;
  }
  return `${subject} ${isOrAre(relevantRepositories)} waiting to sync.`;
};
