import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceIdentityCredentialService = createSubspaceService(
  subspace.identityCredential,
  ['get', 'list', 'create', 'update', 'delete'],
  () => ({})
);

export type SubspaceIdentityCredential = Awaited<
  ReturnType<typeof subspace.identityCredential.get>
>;
