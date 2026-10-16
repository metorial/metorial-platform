import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsKeyProvidersValidateOutput = {
  object: 'key_provider_validation';
  keyProviderId: string;
  description: Record<string, any>;
};

export let mapDashboardProjectsKeyProvidersValidateOutput =
  /* @__PURE__ */ mapObject<DashboardProjectsKeyProvidersValidateOutput>([
    'key_provider_id'
  ]);
