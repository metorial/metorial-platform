import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderService = createSubspaceService(
  subspace.provider,
  ['get', 'list', 'update'],
  () => ({})
);

export type SubspaceProvider = Awaited<ReturnType<typeof subspace.provider.get>>;
export type SubspaceProviderType = SubspaceProvider['type'];
