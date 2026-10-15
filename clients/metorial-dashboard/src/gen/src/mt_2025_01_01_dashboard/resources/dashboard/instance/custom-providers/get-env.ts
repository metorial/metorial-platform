import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceCustomProvidersGetEnvOutput = {
  object: 'custom_provider.env';
  env: Record<string, any> | null;
};

export let mapDashboardInstanceCustomProvidersGetEnvOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceCustomProvidersGetEnvOutput>(0);
