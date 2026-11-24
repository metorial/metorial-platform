import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderCategoriesListOutput = {
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

export let mapDashboardInstanceProviderCategoriesListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderCategoriesListOutput>([
    7, 8
  ]);

export type DashboardInstanceProviderCategoriesListQuery = {
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

export let mapDashboardInstanceProviderCategoriesListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderCategoriesListQuery>([
    3,
    [[0, [1, ['provider_id', 'provider_listing_id']]]]
  ]);
