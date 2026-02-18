import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let toolCallService = createSubspaceService(
  subspace.toolCall,
  ['get', 'list', 'create'],
  () => ({})
);

export type SubspaceToolCall = Awaited<ReturnType<typeof subspace.toolCall.get>>;
