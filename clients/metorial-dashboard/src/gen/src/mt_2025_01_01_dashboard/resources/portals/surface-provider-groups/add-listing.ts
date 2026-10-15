import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type PortalsSurfaceProviderGroupsAddListingOutput = {
  object: 'consumer.surface.provider_group';
  id: string;
  name: string;
  description: string | null;
  index: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapPortalsSurfaceProviderGroupsAddListingOutput =
  /* @__PURE__ */ createMapper<PortalsSurfaceProviderGroupsAddListingOutput>(8);

export type PortalsSurfaceProviderGroupsAddListingBody = {
  consumerAccessListingId: string;
};

export let mapPortalsSurfaceProviderGroupsAddListingBody =
  /* @__PURE__ */ mapObject<PortalsSurfaceProviderGroupsAddListingBody>([
    'consumer_access_listing_id'
  ]);
