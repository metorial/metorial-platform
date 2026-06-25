import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceIdentityDelegationConfigService = createSubspaceService(
  subspace.identityDelegationConfig,
  ['get', 'list', 'create', 'update', 'delete'],
  () => ({})
);

export type SubspaceIdentityDelegationConfig = Awaited<
  ReturnType<typeof subspace.identityDelegationConfig.get>
>;
