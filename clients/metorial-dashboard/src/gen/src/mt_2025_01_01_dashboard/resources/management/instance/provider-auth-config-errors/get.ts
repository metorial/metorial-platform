import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceProviderAuthConfigErrorsGetOutput = {
  object: 'provider.auth_config_error';
  id: string;
  status: 'processing' | 'processed';
  type: string;
  code: string;
  message: string;
  authConfigEventId: string | null;
  providerAuthConfigId: string | null;
  providerAuthCredentialsId: string | null;
  providerOauthSetupId: string | null;
  providerId: string;
  providerInvocationId: string | null;
  groupId: string | null;
  similarErrorCount: number;
  createdAt: Date;
};

export let mapManagementInstanceProviderAuthConfigErrorsGetOutput =
  mtMap.object<ManagementInstanceProviderAuthConfigErrorsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    code: mtMap.objectField('code', mtMap.passthrough()),
    message: mtMap.objectField('message', mtMap.passthrough()),
    authConfigEventId: mtMap.objectField(
      'auth_config_event_id',
      mtMap.passthrough()
    ),
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
    providerInvocationId: mtMap.objectField(
      'provider_invocation_id',
      mtMap.passthrough()
    ),
    groupId: mtMap.objectField('group_id', mtMap.passthrough()),
    similarErrorCount: mtMap.objectField(
      'similar_error_count',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

