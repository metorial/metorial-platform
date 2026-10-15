import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsConfigureAuthConfigGetOutput = {
  object: 'organization.project.auth_config_configuration';
  projectId: string;
  allowAuthConfigExport: boolean;
  allowAuthConfigImport: boolean;
  onlyAllowOauthAuthMethods: boolean;
  consumerAuthClientRegistrationsPerHourLimit: number;
  consumerAuthClientRegistrationsPerMinuteLimit: number;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureAuthConfigGetOutput =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureAuthConfigGetOutput>(
    [
      'project_id',
      'allow_auth_config_export',
      'allow_auth_config_import',
      'only_allow_oauth_auth_methods',
      'consumer_auth_client_registrations_per_hour_limit',
      'consumer_auth_client_registrations_per_minute_limit',
      'updated_at'
    ],
    1
  );
