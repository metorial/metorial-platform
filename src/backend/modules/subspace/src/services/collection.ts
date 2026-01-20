import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../lib/subspace';

export let subspaceCollectionService = createSubspaceService(
  subspace.providerCollection,
  ['get', 'list'] as const
);
