import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../lib/subspace';

export let subspaceCategoryService = createSubspaceService(
  subspace.providerCategory,
  ['get', 'list'] as const
);
