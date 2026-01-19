import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionErrorGroupService = createSubspaceService(
  subspace.sessionErrorGroup,
  ['get', 'list'],
  {}
);
