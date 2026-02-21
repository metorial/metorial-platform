import { createSubspacePublicService, createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderListingCollectionService = createSubspaceService(
  subspace.providerListingCollection,
  ['get', 'list', 'upsert'],
  () => ({})
);

export let subspacePublicProviderListingCollectionService = createSubspacePublicService(
  subspace.providerListingCollection,
  ['get', 'list'],
  () => ({})
);

export type SubspaceProviderListingCollection = Awaited<
  ReturnType<typeof subspace.providerListingCollection.get>
>;
export type SubspaceProviderListingCollectionList = Awaited<
  ReturnType<typeof subspace.providerListingCollection.list>
>;
