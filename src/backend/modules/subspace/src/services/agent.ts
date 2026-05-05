import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceAgentService = createSubspaceService(
  subspace.agent,
  ['get', 'list', 'create', 'update', 'delete'],
  () => ({})
);

export type SubspaceAgent = Awaited<ReturnType<typeof subspace.agent.get>>;
