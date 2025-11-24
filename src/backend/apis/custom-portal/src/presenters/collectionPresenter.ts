import { ServerListingCollection } from '@metorial/db';

export let collectionPresenter = async (collection: ServerListingCollection) => ({
  object: 'portal#server_listing.collection',

  id: collection.id,

  name: collection.name,
  slug: collection.slug,

  createdAt: collection.createdAt,
  updatedAt: collection.updatedAt
});
