import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceIntegrationProviderService = createSubspaceService(
  subspace.integrationProvider,
  ['get', 'list', 'create', 'update', 'delete'],
  () => ({})
);

export type SubspaceIntegrationProvider = Awaited<
  ReturnType<typeof subspace.integrationProvider.get>
>;
