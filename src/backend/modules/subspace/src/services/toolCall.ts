import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceToolCallService = createSubspaceService(
  subspace.toolCall,
  ['get', 'list', 'create'],
  () => ({})
);
