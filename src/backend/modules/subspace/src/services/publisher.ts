import { createSubspacePublicService, createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspacePublisherService = createSubspaceService(
  subspace.publisher,
  ['get', 'list'],
  () => ({})
);

export let subspacePublicPublisherService = createSubspacePublicService(
  subspace.publisher,
  ['get', 'list'],
  () => ({})
);

export type SubspacePublisher = Awaited<ReturnType<typeof subspace.publisher.get>>;
