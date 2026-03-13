import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceIdentityActorService = createSubspaceService(
  subspace.identityActor,
  ['get', 'list', 'create', 'update', 'delete'],
  () => ({})
);

export type SubspaceIdentityActor = Awaited<ReturnType<typeof subspace.identityActor.get>>;
