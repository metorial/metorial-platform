import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstancePortalsSurfaceProviderGroupsAddListingOutput = {
  object: 'consumer.surface.provider_group';
  id: string;
  name: string;
  description: string | null;
  index: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstancePortalsSurfaceProviderGroupsAddListingOutput =
  /* @__PURE__ */ createMapper<ManagementInstancePortalsSurfaceProviderGroupsAddListingOutput>(
    8
  );

export type ManagementInstancePortalsSurfaceProviderGroupsAddListingBody = {
  consumerAccessListingId: string;
};

export let mapManagementInstancePortalsSurfaceProviderGroupsAddListingBody =
  /* @__PURE__ */ mapObject<ManagementInstancePortalsSurfaceProviderGroupsAddListingBody>(
    ['consumer_access_listing_id']
  );
