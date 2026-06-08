import { mtMap } from '@metorial/util-resource-mapper';

export type CustomProvidersVersionsGetEnvOutput = {
  object: 'custom_provider.env';
  env: Record<string, any> | null;
};

export let mapCustomProvidersVersionsGetEnvOutput =
  mtMap.object<CustomProvidersVersionsGetEnvOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    env: mtMap.objectField('env', mtMap.passthrough())
  });

