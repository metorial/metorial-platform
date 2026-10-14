import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceCustomProvidersGetEnvOutput = {
  object: 'custom_provider.env';
  env: Record<string, any> | null;
};

export let mapManagementInstanceCustomProvidersGetEnvOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceCustomProvidersGetEnvOutput>(
    0
  );
