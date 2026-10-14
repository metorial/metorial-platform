import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ProviderCategoriesGetOutput = {
  object: 'provider.listing_category';
  id: string;
  name: string;
  description: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapProviderCategoriesGetOutput =
  /* @__PURE__ */ createMapper<ProviderCategoriesGetOutput>(8);
