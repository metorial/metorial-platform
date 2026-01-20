import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../lib/subspace';

export let subspacePublisherService = createSubspaceService(
  subspace.providerPublisher,
  ['get', 'list'] as const
);
