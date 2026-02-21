import { createSubspacePublicService, createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderListingService = createSubspaceService(
  subspace.providerListing,
  ['get', 'list'],
  () => ({})
);

export let subspacePublicProviderListingService = createSubspacePublicService(
  subspace.providerListing,
  ['get', 'list'],
  () => ({})
);

export type SubspaceProviderListing = Awaited<ReturnType<typeof subspace.providerListing.get>>;
export type SubspaceProviderListingList = Awaited<
  ReturnType<typeof subspace.providerListing.list>
>;
export type SubspaceProviderListingListItem = SubspaceProviderListingList['items'][number];
