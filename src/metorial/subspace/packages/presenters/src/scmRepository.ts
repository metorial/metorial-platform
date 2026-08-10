import type { ScmRepo } from '@metorial-subspace/db';

export let scmRepositoryPresenter = (scmRepository: ScmRepo) => ({
  object: 'scm.repository',

  id: scmRepository.id,

  provider: {
    object: 'scm.provider',

    type: scmRepository.provider,
    id: scmRepository.externalId,
    name: scmRepository.externalName,
    owner: scmRepository.externalOwner
  },

  url: scmRepository.externalUrl,
  isPrivate: scmRepository.externalIsPrivate,
  defaultBranch: scmRepository.defaultBranch,

  createdAt: scmRepository.createdAt
});
