import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderCategoriesGetOutput = {
  object: 'provider.listing_category';
  id: string;
  name: string;
  description: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceProviderCategoriesGetOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderCategoriesGetOutput>(8);
