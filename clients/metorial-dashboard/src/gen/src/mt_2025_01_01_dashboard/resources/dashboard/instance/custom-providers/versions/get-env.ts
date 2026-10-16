import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceCustomProvidersVersionsGetEnvOutput = {
  object: 'custom_provider.env';
  env: Record<string, any> | null;
};

export let mapDashboardInstanceCustomProvidersVersionsGetEnvOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceCustomProvidersVersionsGetEnvOutput>(
    0
  );
