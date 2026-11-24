import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ProviderCollectionsListOutput = {
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

export let mapProviderCollectionsListOutput =
  /* @__PURE__ */ createMapper<ProviderCollectionsListOutput>([7, 8]);

export type ProviderCollectionsListQuery = {
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

export let mapProviderCollectionsListQuery =
  /* @__PURE__ */ createMapper<ProviderCollectionsListQuery>([
    3,
    [[0, [1, ['provider_id', 'provider_listing_id']]]]
  ]);
