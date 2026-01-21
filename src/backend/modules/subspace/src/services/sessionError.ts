import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionErrorService = createSubspaceService(
  subspace.sessionError,
  ['get', 'list'],
  () => ({})
);
