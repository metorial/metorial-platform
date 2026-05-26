import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardProjectsKeyProvidersValidateOutput = {
  object: 'key_provider_validation';
  keyProviderId: string;
  description: Record<string, any>;
};

export let mapDashboardProjectsKeyProvidersValidateOutput =
  mtMap.object<DashboardProjectsKeyProvidersValidateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    keyProviderId: mtMap.objectField('key_provider_id', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough())
  });

