import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionProviderService = createSubspaceService(
  subspace.sessionProvider,
  ['get', 'list', 'create', 'update', 'delete'],
  {}
);
