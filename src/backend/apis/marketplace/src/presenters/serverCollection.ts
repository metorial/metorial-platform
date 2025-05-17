import { ServerListingCollection } from '@metorial/db';

export let serverCollectionPresenter = (collection: ServerListingCollection) => ({
  object: 'marketplace*server_listing.collection',

  id: collection.id,

  name: collection.name,
  slug: collection.slug,
  description: collection.description,

  createdAt: collection.createdAt,
  updatedAt: collection.updatedAt
});
