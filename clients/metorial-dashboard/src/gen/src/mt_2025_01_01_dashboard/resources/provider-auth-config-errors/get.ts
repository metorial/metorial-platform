import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ProviderAuthConfigErrorsGetOutput = {
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

export let mapProviderAuthConfigErrorsGetOutput =
  /* @__PURE__ */ mapObject<ProviderAuthConfigErrorsGetOutput>(
    [
      'auth_config_event_id',
      'provider_auth_config_id',
      'provider_auth_credentials_id',
      'provider_oauth_setup_id',
      'provider_id',
      'provider_invocation_id',
      'group_id',
      'similar_error_count',
      'created_at'
    ],
    1
  );
