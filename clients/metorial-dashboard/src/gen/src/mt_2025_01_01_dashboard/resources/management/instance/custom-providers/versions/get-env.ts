import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceCustomProvidersVersionsGetEnvOutput = {
  object: 'custom_provider.env';
  env: Record<string, any> | null;
};

export let mapManagementInstanceCustomProvidersVersionsGetEnvOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceCustomProvidersVersionsGetEnvOutput>(
    0
  );
