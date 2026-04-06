import type { ScmAccount, ScmRepository } from '../../prisma/generated/client';
import { scmAccountPresenter } from './scmAccount';

export let repositoryPresenter = (repository: ScmRepository & { account: ScmAccount }) => ({
  object: 'origin#repository',

  id: repository.id,
  identifier: repository.identifier,
  name: repository.name,

  provider: repository.provider,
  externalId: repository.externalId,
  externalOwner: repository.externalOwner,
  externalName: repository.externalName,
  externalUrl: repository.externalUrl,
  externalIsPrivate: repository.externalIsPrivate,

  defaultBranch: repository.defaultBranch,

  account: repository.account ? scmAccountPresenter(repository.account) : undefined,

  createdAt: repository.createdAt,
  updatedAt: repository.updatedAt
});
