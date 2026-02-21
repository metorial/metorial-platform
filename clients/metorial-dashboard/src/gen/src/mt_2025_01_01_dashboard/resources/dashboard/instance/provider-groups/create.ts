import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProviderGroupsCreateOutput = {
  object: 'provider.group';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceProviderGroupsCreateOutput =
  mtMap.object<DashboardInstanceProviderGroupsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstanceProviderGroupsCreateBody = {
  name: string;
  description?: string | undefined;
};

export let mapDashboardInstanceProviderGroupsCreateBody =
  mtMap.object<DashboardInstanceProviderGroupsCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough())
  });

