import { mtMap } from '@metorial/util-resource-mapper';

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
  mtMap.object<ManagementInstancePortalsSurfaceProviderGroupsAddListingOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    index: mtMap.objectField('index', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstancePortalsSurfaceProviderGroupsAddListingBody = {
  consumerAccessListingId: string;
};

export let mapManagementInstancePortalsSurfaceProviderGroupsAddListingBody =
  mtMap.object<ManagementInstancePortalsSurfaceProviderGroupsAddListingBody>({
    consumerAccessListingId: mtMap.objectField(
      'consumer_access_listing_id',
      mtMap.passthrough()
    )
  });

