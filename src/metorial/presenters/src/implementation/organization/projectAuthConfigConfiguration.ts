import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { projectAuthConfigConfigurationType } from '../../types';

export let v1ProjectAuthConfigConfigurationPresenter = Presenter.create(
  projectAuthConfigConfigurationType
)
  .presenter(
    async ({
      project,
      allowAuthConfigExport,
      allowAuthConfigImport,
      onlyAllowOAuthAuthMethods,
      consumerAuthClientRegistrationsPerHourLimit,
      consumerAuthClientRegistrationsPerMinuteLimit
    }) => ({
      object: 'organization.project.auth_config_configuration' as const,

      project_id: project.id,
      allow_auth_config_export: allowAuthConfigExport,
      allow_auth_config_import: allowAuthConfigImport,
      only_allow_oauth_auth_methods: onlyAllowOAuthAuthMethods,
      consumer_auth_client_registrations_per_hour_limit:
        consumerAuthClientRegistrationsPerHourLimit,
      consumer_auth_client_registrations_per_minute_limit:
        consumerAuthClientRegistrationsPerMinuteLimit,
      updated_at: project.updatedAt
    })
  )
  .schema(
    v.object({
      object: v.literal('organization.project.auth_config_configuration'),
      project_id: v.string(),
      allow_auth_config_export: v.boolean(),
      allow_auth_config_import: v.boolean(),
      only_allow_oauth_auth_methods: v.boolean(),
      consumer_auth_client_registrations_per_hour_limit: v.number(),
      consumer_auth_client_registrations_per_minute_limit: v.number(),
      updated_at: v.date()
    })
  )
  .build();
