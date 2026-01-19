import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderService = createSubspaceService(
  subspace.provider,
  ['get', 'list', 'update'],
  () => ({})
);
