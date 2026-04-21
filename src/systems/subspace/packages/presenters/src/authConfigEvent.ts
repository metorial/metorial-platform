import type {
  AuthConfigEvent,
  Provider,
  ProviderAuthConfig,
  ProviderAuthCredentials,
  ProviderOAuthSetup
} from '@metorial-subspace/db';

export let authConfigEventPresenter = async (
  event: AuthConfigEvent & {
    authConfig: ProviderAuthConfig | null;
    authCredentials: ProviderAuthCredentials | null;
    oauthSetup: ProviderOAuthSetup | null;
    provider: Provider;
  }
) => ({
  object: 'auth_config.event',

  id: event.id,
  type: event.type,
  sourceType: event.sourceType,
  sourceId: event.sourceId,

  authConfigId: event.authConfig?.id ?? null,
  authCredentialsId: event.authCredentials?.id ?? null,
  providerOAuthSetupId: event.oauthSetup?.id ?? null,
  providerId: event.provider.id,

  providerInvocationId: event.providerInvocationId,

  data: event.payload,

  createdAt: event.createdAt,
  updatedAt: event.updatedAt
});
