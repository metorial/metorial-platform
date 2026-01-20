import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../lib/subspace';

export let subspaceGroupService = createSubspaceService(
  subspace.providerGroup,
  ['get', 'list', 'create', 'update'] as const
);
