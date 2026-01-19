import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionMessageService = createSubspaceService(
  subspace.sessionMessage,
  ['get', 'list'],
  {}
);
