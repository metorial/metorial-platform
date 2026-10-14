import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsConfigureAuthConfigUpdateOutput = {
  object: 'organization.project.auth_config_configuration';
  projectId: string;
  allowAuthConfigExport: boolean;
  allowAuthConfigImport: boolean;
  onlyAllowOauthAuthMethods: boolean;
  consumerAuthClientRegistrationsPerHourLimit: number;
  consumerAuthClientRegistrationsPerMinuteLimit: number;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureAuthConfigUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureAuthConfigUpdateOutput>(
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

export type DashboardProjectsConfigureAuthConfigUpdateBody = {
  allowAuthConfigExport?: boolean | undefined;
  allowAuthConfigImport?: boolean | undefined;
  onlyAllowOauthAuthMethods?: boolean | undefined;
  consumerAuthClientRegistrationsPerHourLimit?: number | undefined;
  consumerAuthClientRegistrationsPerMinuteLimit?: number | undefined;
};

export let mapDashboardProjectsConfigureAuthConfigUpdateBody =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureAuthConfigUpdateBody>([
    'allow_auth_config_export',
    'allow_auth_config_import',
    'only_allow_oauth_auth_methods',
    'consumer_auth_client_registrations_per_hour_limit',
    'consumer_auth_client_registrations_per_minute_limit'
  ]);
