import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceScmRepositoryService = createSubspaceService(
  subspace.scmRepository,
  [
    'get',
    'list',
    'listAccountPreviews',
    'listRepositoryPreviews',
    'createRepository',
    'linkRepository'
  ],
  () => ({})
);

export type SubspaceScmRepository = Awaited<ReturnType<typeof subspace.scmRepository.get>>;

export type SubspaceScmRepositoryPreviews = Awaited<
  ReturnType<typeof subspace.scmRepository.listRepositoryPreviews>
>;

export type SubspaceScmAccountPreviews = Awaited<
  ReturnType<typeof subspace.scmRepository.listAccountPreviews>
>;
