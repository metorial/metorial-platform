import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderDeploymentService = createSubspaceService(
  subspace.providerDeployment,
  ['get', 'list', 'update', 'create'],
  () => ({})
);

export type SubspaceProviderDeployment = Awaited<
  ReturnType<typeof subspace.providerDeployment.get>
>;
