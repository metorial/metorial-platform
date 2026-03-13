import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceIdentityService = createSubspaceService(
  subspace.identity,
  ['get', 'list', 'create', 'update', 'delete'],
  () => ({})
);

export type SubspaceIdentity = Awaited<ReturnType<typeof subspace.identity.get>>;
