import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceContainerRegistryService = createSubspaceService(
  subspace.containerRegistry,
  ['get', 'list'],
  () => ({})
);

export type SubspaceContainerRegistry = Awaited<
  ReturnType<typeof subspace.containerRegistry.get>
>;
