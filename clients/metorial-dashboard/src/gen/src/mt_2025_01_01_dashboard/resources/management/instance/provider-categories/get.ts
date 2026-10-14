import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderCategoriesGetOutput = {
  object: 'provider.listing_category';
  id: string;
  name: string;
  description: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceProviderCategoriesGetOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderCategoriesGetOutput>(
    8
  );
