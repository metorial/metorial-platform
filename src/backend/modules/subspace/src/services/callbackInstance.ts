import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceCallbackInstanceService = createSubspaceService(
  subspace.callbackInstance,
  ['list', 'attach', 'detach'],
  () => ({})
);

export type SubspaceCallbackInstance = Awaited<
  ReturnType<typeof subspace.callbackInstance.attach>
>;
