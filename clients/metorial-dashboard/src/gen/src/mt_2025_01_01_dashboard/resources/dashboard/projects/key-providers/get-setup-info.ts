import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsKeyProvidersGetSetupInfoOutput = {
  object: 'key_provider_setup_info';
  steps: {
    title: string;
    description: string;
    markdown?: string | undefined;
    inputs?:
      | {
          type: 'text' | 'json';
          key: string;
          label: string;
          description: string;
        }[]
      | undefined;
  }[];
};

export let mapDashboardProjectsKeyProvidersGetSetupInfoOutput =
  /* @__PURE__ */ createMapper<DashboardProjectsKeyProvidersGetSetupInfoOutput>(
    0
  );

export type DashboardProjectsKeyProvidersGetSetupInfoQuery = {
  region?: string | undefined;
  keyId?: string | undefined;
};

export let mapDashboardProjectsKeyProvidersGetSetupInfoQuery =
  /* @__PURE__ */ mapObject<DashboardProjectsKeyProvidersGetSetupInfoQuery>([
    'key_id'
  ]);
