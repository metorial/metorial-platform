import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderInvocationService = createSubspaceService(
  subspace.providerDeployment,
  ['get', 'list'],
  inner => ({})
);

export type SubspaceProviderInvocation = Awaited<
  ReturnType<typeof subspace.providerInvocation.get>
>;
