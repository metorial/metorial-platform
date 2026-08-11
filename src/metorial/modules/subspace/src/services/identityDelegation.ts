import { getSentry } from '@lowerdeck/sentry';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

let Sentry = getSentry();

export let subspaceIdentityDelegationService = createSubspaceService(
  subspace.identityDelegation,
  ['get', 'list', 'create', 'revoke'],
  inner => ({})
);

export type SubspaceIdentityDelegation = Awaited<
  ReturnType<typeof subspace.identityDelegation.get>
>;
