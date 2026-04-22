import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProviderAuthConfigEventsGetOutput = {
  object: 'provider.auth_config_event';
  id: string;
  type: string;
  status: 'success' | 'error';
  sourceType: string;
  sourceId: string;
  providerAuthConfigId: string | null;
  providerAuthCredentialsId: string | null;
  providerOauthSetupId: string | null;
  providerId: string;
  providerAuthErrorId: string | null;
  providerInvocationId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceProviderAuthConfigEventsGetOutput =
  mtMap.object<DashboardInstanceProviderAuthConfigEventsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    sourceType: mtMap.objectField('source_type', mtMap.passthrough()),
    sourceId: mtMap.objectField('source_id', mtMap.passthrough()),
    providerAuthConfigId: mtMap.objectField(
      'provider_auth_config_id',
      mtMap.passthrough()
    ),
    providerAuthCredentialsId: mtMap.objectField(
      'provider_auth_credentials_id',
      mtMap.passthrough()
    ),
    providerOauthSetupId: mtMap.objectField(
      'provider_oauth_setup_id',
      mtMap.passthrough()
    ),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    providerAuthErrorId: mtMap.objectField(
      'provider_auth_error_id',
      mtMap.passthrough()
    ),
    providerInvocationId: mtMap.objectField(
      'provider_invocation_id',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

