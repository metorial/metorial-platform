import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstancePortalsSurfaceProviderGroupsAddListingOutput = {
  object: 'consumer.surface.provider_group';
  id: string;
  name: string;
  description: string | null;
  index: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstancePortalsSurfaceProviderGroupsAddListingOutput =
  /* @__PURE__ */ createMapper<DashboardInstancePortalsSurfaceProviderGroupsAddListingOutput>(
    8
  );

export type DashboardInstancePortalsSurfaceProviderGroupsAddListingBody = {
  consumerAccessListingId: string;
};

export let mapDashboardInstancePortalsSurfaceProviderGroupsAddListingBody =
  /* @__PURE__ */ mapObject<DashboardInstancePortalsSurfaceProviderGroupsAddListingBody>(
    ['consumer_access_listing_id']
  );
