import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceCallbackInstanceService = createSubspaceService(
  subspace.callbackInstance,
  ['get', 'list', 'attach', 'detach'],
  inner => ({})
);

export type SubspaceCallbackInstance = Awaited<
  ReturnType<typeof subspace.callbackInstance.get>
>;
