import { createMapper } from '@metorial/util-resource-mapper/compact';

export type CustomProvidersGetEnvOutput = {
  object: 'custom_provider.env';
  env: Record<string, any> | null;
};

export let mapCustomProvidersGetEnvOutput =
  /* @__PURE__ */ createMapper<CustomProvidersGetEnvOutput>(0);
