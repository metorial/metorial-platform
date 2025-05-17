import { ServerListingCategory } from '@metorial/db';

export let serverCategoryPresenter = (category: ServerListingCategory) => ({
  object: 'marketplace*server_listing.category',

  id: category.id,

  name: category.name,
  slug: category.slug,
  description: category.description,

  createdAt: category.createdAt,
  updatedAt: category.updatedAt
});
