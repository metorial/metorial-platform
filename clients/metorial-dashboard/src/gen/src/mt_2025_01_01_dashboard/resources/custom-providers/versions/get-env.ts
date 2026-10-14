import { createMapper } from '@metorial/util-resource-mapper/compact';

export type CustomProvidersVersionsGetEnvOutput = {
  object: 'custom_provider.env';
  env: Record<string, any> | null;
};

export let mapCustomProvidersVersionsGetEnvOutput =
  /* @__PURE__ */ createMapper<CustomProvidersVersionsGetEnvOutput>(0);
