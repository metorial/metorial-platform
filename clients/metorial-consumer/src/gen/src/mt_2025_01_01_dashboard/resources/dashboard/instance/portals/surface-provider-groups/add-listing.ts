import { mtMap } from '@metorial/util-resource-mapper';

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
  mtMap.object<DashboardInstancePortalsSurfaceProviderGroupsAddListingOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    index: mtMap.objectField('index', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstancePortalsSurfaceProviderGroupsAddListingBody = {
  consumerAccessListingId: string;
};

export let mapDashboardInstancePortalsSurfaceProviderGroupsAddListingBody =
  mtMap.object<DashboardInstancePortalsSurfaceProviderGroupsAddListingBody>({
    consumerAccessListingId: mtMap.objectField(
      'consumer_access_listing_id',
      mtMap.passthrough()
    )
  });

