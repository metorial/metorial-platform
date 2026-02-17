import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let scmRepositoryService = createSubspaceService(
  subspace.scmRepository,
  ['get', 'list', 'listAccountPreviews', 'listRepositoryPreviews'],
  () => ({})
);

export type ScmRepository = Awaited<ReturnType<typeof subspace.scmRepository.get>>;
