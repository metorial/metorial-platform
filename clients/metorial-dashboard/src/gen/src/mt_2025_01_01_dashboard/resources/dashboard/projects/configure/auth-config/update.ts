import { mtMap } from '@metorial/util-resource-mapper';

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
  mtMap.object<DashboardProjectsConfigureAuthConfigUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    projectId: mtMap.objectField('project_id', mtMap.passthrough()),
    allowAuthConfigExport: mtMap.objectField(
      'allow_auth_config_export',
      mtMap.passthrough()
    ),
    allowAuthConfigImport: mtMap.objectField(
      'allow_auth_config_import',
      mtMap.passthrough()
    ),
    onlyAllowOauthAuthMethods: mtMap.objectField(
      'only_allow_oauth_auth_methods',
      mtMap.passthrough()
    ),
    consumerAuthClientRegistrationsPerHourLimit: mtMap.objectField(
      'consumer_auth_client_registrations_per_hour_limit',
      mtMap.passthrough()
    ),
    consumerAuthClientRegistrationsPerMinuteLimit: mtMap.objectField(
      'consumer_auth_client_registrations_per_minute_limit',
      mtMap.passthrough()
    ),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardProjectsConfigureAuthConfigUpdateBody = {
  allowAuthConfigExport?: boolean | undefined;
  allowAuthConfigImport?: boolean | undefined;
  onlyAllowOauthAuthMethods?: boolean | undefined;
  consumerAuthClientRegistrationsPerHourLimit?: number | undefined;
  consumerAuthClientRegistrationsPerMinuteLimit?: number | undefined;
};

export let mapDashboardProjectsConfigureAuthConfigUpdateBody =
  mtMap.object<DashboardProjectsConfigureAuthConfigUpdateBody>({
    allowAuthConfigExport: mtMap.objectField(
      'allow_auth_config_export',
      mtMap.passthrough()
    ),
    allowAuthConfigImport: mtMap.objectField(
      'allow_auth_config_import',
      mtMap.passthrough()
    ),
    onlyAllowOauthAuthMethods: mtMap.objectField(
      'only_allow_oauth_auth_methods',
      mtMap.passthrough()
    ),
    consumerAuthClientRegistrationsPerHourLimit: mtMap.objectField(
      'consumer_auth_client_registrations_per_hour_limit',
      mtMap.passthrough()
    ),
    consumerAuthClientRegistrationsPerMinuteLimit: mtMap.objectField(
      'consumer_auth_client_registrations_per_minute_limit',
      mtMap.passthrough()
    )
  });

