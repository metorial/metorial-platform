import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstancePortalsSurfaceProviderGroupsCreateOutput = {
  object: 'consumer.surface.provider_group';
  id: string;
  name: string;
  description: string | null;
  index: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstancePortalsSurfaceProviderGroupsCreateOutput =
  mtMap.object<ManagementInstancePortalsSurfaceProviderGroupsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    index: mtMap.objectField('index', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstancePortalsSurfaceProviderGroupsCreateBody = {
  name: string;
  description?: string | undefined;
};

export let mapManagementInstancePortalsSurfaceProviderGroupsCreateBody =
  mtMap.object<ManagementInstancePortalsSurfaceProviderGroupsCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough())
  });

