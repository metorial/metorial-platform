import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let customProviderService = createSubspaceService(
  subspace.customProvider,
  ['get', 'list', 'update', 'create'],
  () => ({})
);

export type CustomProvider = Awaited<ReturnType<typeof subspace.customProvider.get>>;
