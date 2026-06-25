import { createSubspacePublicService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceActorService = createSubspacePublicService(
  subspace.actor,
  ['upsert', 'get'],
  () => ({})
);
