import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspacePublisherService = createSubspaceService(
  subspace.publisher,
  ['get', 'list'],
  () => ({})
);

export type Publisher = Awaited<ReturnType<typeof subspace.providerRun.get>>;
