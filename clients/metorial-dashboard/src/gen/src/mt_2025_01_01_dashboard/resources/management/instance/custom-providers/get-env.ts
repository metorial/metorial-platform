import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceCustomProvidersGetEnvOutput = {
  object: 'custom_provider.env';
  env: Record<string, any> | null;
};

export let mapManagementInstanceCustomProvidersGetEnvOutput =
  mtMap.object<ManagementInstanceCustomProvidersGetEnvOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    env: mtMap.objectField('env', mtMap.passthrough())
  });

