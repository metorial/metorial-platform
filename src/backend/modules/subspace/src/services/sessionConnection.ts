import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionConnectionService = createSubspaceService(
  subspace.sessionConnection,
  ['get', 'list'],
  () => ({})
);

export type SubspaceSessionConnection = Awaited<
  ReturnType<typeof subspace.sessionConnection.get>
>;
