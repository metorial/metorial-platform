import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceIntegrationInstanceGroupProviderService = createSubspaceService(
  subspace.integrationInstanceGroupProvider,
  ['get', 'list', 'set', 'delete'],
  () => ({})
);

export type SubspaceIntegrationInstanceGroupProvider = Awaited<
  ReturnType<typeof subspace.integrationInstanceGroupProvider.get>
>;
