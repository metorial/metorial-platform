import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceScmConnectionService = createSubspaceService(
  subspace.scmConnection,
  ['get', 'list'],
  () => ({})
);

export type SubspaceScmConnection = Awaited<ReturnType<typeof subspace.scmConnection.get>>;
