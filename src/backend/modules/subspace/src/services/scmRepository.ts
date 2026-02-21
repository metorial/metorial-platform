import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let scmRepositoryService = createSubspaceService(
  subspace.scmRepository,
  ['get', 'list', 'listAccountPreviews', 'listRepositoryPreviews', 'createRepository', 'linkRepository'],
  () => ({})
);

export type SubspaceScmRepository = Awaited<ReturnType<typeof subspace.scmRepository.get>>;
