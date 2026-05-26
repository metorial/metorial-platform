import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsProjectsKeyProvidersValidateOutput = {
  object: 'key_provider_validation';
  keyProviderId: string;
  description: Record<string, unknown>;
};

export let mapDashboardOrganizationsProjectsKeyProvidersValidateOutput =
  mtMap.object<DashboardOrganizationsProjectsKeyProvidersValidateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    keyProviderId: mtMap.objectField('key_provider_id', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough())
  });
