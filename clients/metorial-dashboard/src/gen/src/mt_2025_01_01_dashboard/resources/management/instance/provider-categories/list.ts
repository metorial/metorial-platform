import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderCategoriesListOutput = {
  items: {
    object: 'provider.listing_category';
    id: string;
    name: string;
    description: string;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceProviderCategoriesListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderCategoriesListOutput>([
    7, 8
  ]);

export type ManagementInstanceProviderCategoriesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  providerListingId?: string | string[] | undefined;
};

export let mapManagementInstanceProviderCategoriesListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderCategoriesListQuery>([
    3,
    [[0, [1, ['provider_id', 'provider_listing_id']]]]
  ]);
