import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceIdentityDelegationService = createSubspaceService(
  subspace.identityDelegation,
  ['get', 'list', 'create', 'revoke'],
  () => ({})
);

export type SubspaceIdentityDelegation = Awaited<
  ReturnType<typeof subspace.identityDelegation.get>
>;
