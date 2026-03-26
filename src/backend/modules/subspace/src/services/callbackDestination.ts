import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceCallbackDestinationService = createSubspaceService(
  subspace.callbackDestination,
  ['get', 'list', 'create', 'update', 'archive'],
  () => ({})
);

export type SubspaceCallbackDestination = Awaited<
  ReturnType<typeof subspace.callbackDestination.get>
>;
