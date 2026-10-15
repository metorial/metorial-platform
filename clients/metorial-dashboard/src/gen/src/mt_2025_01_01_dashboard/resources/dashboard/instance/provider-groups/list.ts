import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderGroupsListOutput = {
  items: {
    object: 'provider.listing_group';
    id: string;
    name: string;
    description: string | null;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceProviderGroupsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderGroupsListOutput>([
    7, 8
  ]);

export type DashboardInstanceProviderGroupsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  providerListingId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardInstanceProviderGroupsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderGroupsListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'provider_id',
            'provider_listing_id',
            ['created_at', 1, 5],
            ['updated_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
