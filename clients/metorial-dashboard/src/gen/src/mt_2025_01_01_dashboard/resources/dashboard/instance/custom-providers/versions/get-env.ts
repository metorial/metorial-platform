import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCustomProvidersVersionsGetEnvOutput = {
  object: 'custom_provider.env';
  env: Record<string, any> | null;
};

export let mapDashboardInstanceCustomProvidersVersionsGetEnvOutput =
  mtMap.object<DashboardInstanceCustomProvidersVersionsGetEnvOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    env: mtMap.objectField('env', mtMap.passthrough())
  });

