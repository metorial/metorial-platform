import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstancePortalsSurfaceProviderGroupsUpdateOutput = {
  object: 'consumer.surface.provider_group';
  id: string;
  name: string;
  description: string | null;
  index: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstancePortalsSurfaceProviderGroupsUpdateOutput =
  mtMap.object<DashboardInstancePortalsSurfaceProviderGroupsUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    index: mtMap.objectField('index', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstancePortalsSurfaceProviderGroupsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  index?: number | undefined;
};

export let mapDashboardInstancePortalsSurfaceProviderGroupsUpdateBody =
  mtMap.object<DashboardInstancePortalsSurfaceProviderGroupsUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    index: mtMap.objectField('index', mtMap.passthrough())
  });

