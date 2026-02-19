import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProviderGroupsUpdateOutput = {
  object: 'provider.group';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceProviderGroupsUpdateOutput =
  mtMap.object<DashboardInstanceProviderGroupsUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstanceProviderGroupsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
};

export let mapDashboardInstanceProviderGroupsUpdateBody =
  mtMap.object<DashboardInstanceProviderGroupsUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough())
  });
