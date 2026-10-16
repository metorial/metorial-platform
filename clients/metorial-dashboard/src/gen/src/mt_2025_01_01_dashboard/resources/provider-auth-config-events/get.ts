import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ProviderAuthConfigEventsGetOutput = {
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

export let mapProviderAuthConfigEventsGetOutput =
  /* @__PURE__ */ mapObject<ProviderAuthConfigEventsGetOutput>(
    [
      'source_type',
      'source_id',
      'provider_auth_config_id',
      'provider_auth_credentials_id',
      'provider_oauth_setup_id',
      'provider_id',
      'provider_auth_error_id',
      'provider_invocation_id',
      'created_at',
      'updated_at'
    ],
    1
  );
