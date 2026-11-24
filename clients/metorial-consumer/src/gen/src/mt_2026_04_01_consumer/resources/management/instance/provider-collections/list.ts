import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderCollectionsListOutput = {
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

export let mapManagementInstanceProviderCollectionsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderCollectionsListOutput>(
    [7, 8]
  );

export type ManagementInstanceProviderCollectionsListQuery = {
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

export let mapManagementInstanceProviderCollectionsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderCollectionsListQuery>([
    3,
    [[0, [1, ['provider_id', 'provider_listing_id']]]]
  ]);
