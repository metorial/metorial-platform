import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceResourceCountService = createSubspaceService(
  subspace.resourceCount,
  ['get'],
  () => ({})
);

export type SubspaceResourceCounts = Awaited<ReturnType<typeof subspace.resourceCount.get>>;
