import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceIntegrationInstanceService = createSubspaceService(
  subspace.integrationInstance,
  ['get', 'list', 'create', 'update', 'delete', 'createSessionTemplate', 'createSession'],
  () => ({})
);

export type SubspaceIntegrationInstance = Awaited<
  ReturnType<typeof subspace.integrationInstance.get>
>;
