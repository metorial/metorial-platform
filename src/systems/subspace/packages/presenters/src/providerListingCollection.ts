import type { ProviderListingCollection } from '@metorial-subspace/db';

export let providerListingCollectionPresenter = (
  providerListingCollection: ProviderListingCollection
) => ({
  object: 'provider.listing_collection',

  id: providerListingCollection.id,

  name: providerListingCollection.name,
  description: providerListingCollection.description,
  slug: providerListingCollection.slug,

  createdAt: providerListingCollection.createdAt,
  updatedAt: providerListingCollection.updatedAt
});
