import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../lib/subspace';

export let subspaceProviderService = createSubspaceService(
  subspace.provider,
  ['get', 'list'] as const
);
