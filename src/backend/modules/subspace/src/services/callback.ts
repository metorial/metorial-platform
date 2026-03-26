import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceCallbackService = createSubspaceService(
  subspace.callback,
  ['get', 'list', 'create', 'update', 'archive'],
  () => ({})
);

export type SubspaceCallback = Awaited<ReturnType<typeof subspace.callback.get>>;
