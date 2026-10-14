import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderCollectionsListOutput = {
  items: {
    object: 'provider.listing_collection';
    id: string;
    name: string;
    description: string;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceProviderCollectionsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderCollectionsListOutput>([
    7, 8
  ]);

export type DashboardInstanceProviderCollectionsListQuery = {
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

export let mapDashboardInstanceProviderCollectionsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderCollectionsListQuery>([
    3,
    [[0, [1, ['provider_id', 'provider_listing_id']]]]
  ]);
