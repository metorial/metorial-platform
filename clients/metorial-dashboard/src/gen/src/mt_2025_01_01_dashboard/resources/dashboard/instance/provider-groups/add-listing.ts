import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderGroupsAddListingOutput = {
  object: 'provider.listing_group';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceProviderGroupsAddListingOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderGroupsAddListingOutput>(
    8
  );

export type DashboardInstanceProviderGroupsAddListingBody = {
  providerListingId: string;
};

export let mapDashboardInstanceProviderGroupsAddListingBody =
  /* @__PURE__ */ mapObject<DashboardInstanceProviderGroupsAddListingBody>([
    'provider_listing_id'
  ]);
