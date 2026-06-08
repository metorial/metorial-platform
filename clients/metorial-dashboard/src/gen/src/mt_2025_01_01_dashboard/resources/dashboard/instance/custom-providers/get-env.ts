import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCustomProvidersGetEnvOutput = {
  object: 'custom_provider.env';
  env: Record<string, any> | null;
};

export let mapDashboardInstanceCustomProvidersGetEnvOutput =
  mtMap.object<DashboardInstanceCustomProvidersGetEnvOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    env: mtMap.objectField('env', mtMap.passthrough())
  });

