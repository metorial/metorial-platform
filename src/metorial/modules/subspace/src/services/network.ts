import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceNetworkService = createSubspaceService(
  subspace.network,
  ['get', 'list'],
  () => ({})
);

export type SubspaceNetwork = Awaited<ReturnType<typeof subspace.network.get>>;
