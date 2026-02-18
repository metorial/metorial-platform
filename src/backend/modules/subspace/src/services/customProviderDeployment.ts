import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let customProviderDeploymentService = createSubspaceService(
  subspace.customProviderDeployment,
  ['get', 'list', 'getLogs'],
  () => ({})
);

export type SubspaceCustomProviderDeployment = Awaited<ReturnType<typeof subspace.customProviderDeployment.get>>;
