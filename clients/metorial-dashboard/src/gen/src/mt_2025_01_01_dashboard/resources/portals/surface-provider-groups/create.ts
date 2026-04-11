import { mtMap } from '@metorial/util-resource-mapper';

export type PortalsSurfaceProviderGroupsCreateOutput = {
  object: 'consumer.surface.provider_group';
  id: string;
  name: string;
  description: string | null;
  index: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapPortalsSurfaceProviderGroupsCreateOutput =
  mtMap.object<PortalsSurfaceProviderGroupsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    index: mtMap.objectField('index', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type PortalsSurfaceProviderGroupsCreateBody = {
  name: string;
  description?: string | undefined;
};

export let mapPortalsSurfaceProviderGroupsCreateBody =
  mtMap.object<PortalsSurfaceProviderGroupsCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough())
  });

