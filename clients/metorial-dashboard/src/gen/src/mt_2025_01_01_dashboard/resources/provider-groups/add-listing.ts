import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ProviderGroupsAddListingOutput = {
  object: 'provider.listing_group';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapProviderGroupsAddListingOutput =
  /* @__PURE__ */ createMapper<ProviderGroupsAddListingOutput>(8);

export type ProviderGroupsAddListingBody = { providerListingId: string };

export let mapProviderGroupsAddListingBody =
  /* @__PURE__ */ mapObject<ProviderGroupsAddListingBody>([
    'provider_listing_id'
  ]);
