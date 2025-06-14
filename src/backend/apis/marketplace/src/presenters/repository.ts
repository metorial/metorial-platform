import { ImportedRepository } from '@metorial/db';

export let repositoryPresenter = async (repository: ImportedRepository) => ({
  __object: 'marketplace*repository',

  id: repository.id,
  identifier: repository.identifier,
  slug: repository.slug,
  name: repository.name,
  providerUrl: repository.providerUrl,
  websiteUrl: repository.websiteUrl,
  provider: repository.provider,

  starCount: repository.starCount,
  forkCount: repository.forkCount,
  watcherCount: repository.watcherCount,
  openIssuesCount: repository.openIssuesCount,
  subscriptionCount: repository.subscriptionCount,

  defaultBranch: repository.defaultBranch,

  licenseName: repository.licenseName,
  licenseUrl: repository.licenseUrl,
  licenseSpdxId: repository.licenseSpdxId,

  topics: repository.topics,

  language: repository.language,
  description: repository.description,

  createdAt: repository.createdAt,
  updatedAt: repository.updatedAt,
  pushedAt: repository.pushedAt
});
