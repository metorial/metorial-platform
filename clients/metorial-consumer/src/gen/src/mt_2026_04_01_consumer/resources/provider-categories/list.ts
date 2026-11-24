import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ProviderCategoriesListOutput = {
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

export let mapProviderCategoriesListOutput =
  /* @__PURE__ */ createMapper<ProviderCategoriesListOutput>([7, 8]);

export type ProviderCategoriesListQuery = {
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

export let mapProviderCategoriesListQuery =
  /* @__PURE__ */ createMapper<ProviderCategoriesListQuery>([
    3,
    [[0, [1, ['provider_id', 'provider_listing_id']]]]
  ]);
