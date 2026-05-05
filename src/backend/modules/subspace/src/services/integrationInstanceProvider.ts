import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceIntegrationInstanceProviderService = createSubspaceService(
  subspace.integrationInstanceProvider,
  ['get', 'list', 'set'],
  inner => ({})
);

export type SubspaceIntegrationInstanceProvider = Awaited<
  ReturnType<typeof subspace.integrationInstanceProvider.get>
>;
export type SubspaceIntegrationInstanceProviderSnapshot =
  SubspaceIntegrationInstanceProvider['integrationProvider'];
