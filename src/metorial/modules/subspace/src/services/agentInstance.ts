import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceAgentInstanceService = createSubspaceService(
  subspace.agentInstance,
  ['get', 'list'],
  () => ({})
);

export type SubspaceAgentInstance = Awaited<
  ReturnType<typeof subspace.agentInstance.get>
>;
