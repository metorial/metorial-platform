import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceIntegrationInstanceGroupService = createSubspaceService(
  subspace.integrationInstanceGroup,
  ['get', 'list', 'create', 'update', 'delete', 'createSessionTemplate', 'createSession'],
  () => ({})
);

export type SubspaceIntegrationInstanceGroup = Awaited<
  ReturnType<typeof subspace.integrationInstanceGroup.get>
>;
