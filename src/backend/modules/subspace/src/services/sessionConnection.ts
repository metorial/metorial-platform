import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionConnectionService = createSubspaceService(
  subspace.sessionConnection,
  ['get', 'list'],
  () => ({})
);

export type SessionConnection = Awaited<ReturnType<typeof subspace.sessionConnection.get>>;
