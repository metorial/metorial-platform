import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspacePublisherService = createSubspaceService(
  subspace.publisher,
  ['get', 'list'],
  () => ({})
);
