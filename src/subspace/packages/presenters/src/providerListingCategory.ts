import type { ProviderListingCategory } from '@metorial-subspace/db';

export let providerListingCategoryPresenter = (
  providerListingCategory: ProviderListingCategory
) => ({
  object: 'provider.listing_category',

  id: providerListingCategory.id,

  name: providerListingCategory.name,
  description: providerListingCategory.description,
  slug: providerListingCategory.slug,

  createdAt: providerListingCategory.createdAt,
  updatedAt: providerListingCategory.updatedAt
});
