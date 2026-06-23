import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceContainerRepositoryService = createSubspaceService(
  subspace.containerRepository,
  ['get', 'list'],
  () => ({})
);

export type SubspaceContainerRepository = Awaited<
  ReturnType<typeof subspace.containerRepository.get>
>;
