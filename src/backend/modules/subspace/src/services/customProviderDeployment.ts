import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceCustomProviderDeploymentService = createSubspaceService(
  subspace.customProviderDeployment,
  ['get', 'list', 'getLogs'],
  () => ({})
);

export type SubspaceCustomProviderDeployment = Awaited<
  ReturnType<typeof subspace.customProviderDeployment.get>
>;

export type SubspaceCustomProviderDeploymentLogs = Awaited<
  ReturnType<typeof subspace.customProviderDeployment.getLogs>
>;
