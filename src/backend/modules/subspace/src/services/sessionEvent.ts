import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionEventService = createSubspaceService(
  subspace.sessionEvent,
  ['get', 'list'],
  () => ({})
);
