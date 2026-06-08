import { mtMap } from '@metorial/util-resource-mapper';

export type CustomProvidersGetEnvOutput = {
  object: 'custom_provider.env';
  env: Record<string, any> | null;
};

export let mapCustomProvidersGetEnvOutput =
  mtMap.object<CustomProvidersGetEnvOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    env: mtMap.objectField('env', mtMap.passthrough())
  });

