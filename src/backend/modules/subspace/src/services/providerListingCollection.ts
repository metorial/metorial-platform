import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderListingCollectionService = createSubspaceService(
  subspace.providerListingCollection,
  ['get', 'list', 'upsert'],
  () => ({})
);

export type SubspaceProviderListingCollection = Awaited<ReturnType<typeof subspace.providerListingCollection.get>>;
