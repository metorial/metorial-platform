import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let scmConnectionService = createSubspaceService(
  subspace.scmConnection,
  ['get', 'list'],
  () => ({})
);

export type SubspaceScmConnection = Awaited<ReturnType<typeof subspace.scmConnection.get>>;
