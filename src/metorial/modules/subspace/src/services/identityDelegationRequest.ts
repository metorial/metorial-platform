import { getSentry } from '@lowerdeck/sentry';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

let Sentry = getSentry();

export let subspaceIdentityDelegationRequestService = createSubspaceService(
  subspace.identityDelegationRequest,
  ['get', 'list', 'create', 'approve', 'deny'],
  inner => ({})
);

export type SubspaceIdentityDelegationRequest = Awaited<
  ReturnType<typeof subspace.identityDelegationRequest.get>
>;
