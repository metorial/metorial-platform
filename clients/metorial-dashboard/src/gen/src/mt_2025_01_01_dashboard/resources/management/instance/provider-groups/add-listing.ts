import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderGroupsAddListingOutput = {
  object: 'provider.listing_group';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceProviderGroupsAddListingOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderGroupsAddListingOutput>(
    8
  );

export type ManagementInstanceProviderGroupsAddListingBody = {
  providerListingId: string;
};

export let mapManagementInstanceProviderGroupsAddListingBody =
  /* @__PURE__ */ mapObject<ManagementInstanceProviderGroupsAddListingBody>([
    'provider_listing_id'
  ]);
