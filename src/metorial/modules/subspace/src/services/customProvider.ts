import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceCustomProviderService = createSubspaceService(
  subspace.customProvider,
  ['get', 'list', 'update', 'create', 'archive'],
  () => ({})
);

export type SubspaceCustomProvider = Awaited<ReturnType<typeof subspace.customProvider.get>>;
