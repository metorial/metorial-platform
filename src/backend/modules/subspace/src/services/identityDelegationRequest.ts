import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceIdentityDelegationRequestService = createSubspaceService(
  subspace.identityDelegationRequest,
  ['get', 'list', 'create', 'approve', 'deny'],
  () => ({})
);

export type SubspaceIdentityDelegationRequest = Awaited<
  ReturnType<typeof subspace.identityDelegationRequest.get>
>;
