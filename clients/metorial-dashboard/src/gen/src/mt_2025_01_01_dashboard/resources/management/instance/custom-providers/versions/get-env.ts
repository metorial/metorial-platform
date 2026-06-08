import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceCustomProvidersVersionsGetEnvOutput = {
  object: 'custom_provider.env';
  env: Record<string, any> | null;
};

export let mapManagementInstanceCustomProvidersVersionsGetEnvOutput =
  mtMap.object<ManagementInstanceCustomProvidersVersionsGetEnvOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    env: mtMap.objectField('env', mtMap.passthrough())
  });

