import type { AppOAuthProvider } from '@mtsrc/auth-core-db';

export let oauthProviderPresenter = (provider: AppOAuthProvider) => ({
  object: 'ares#oauthProvider' as const,

  id: provider.id,
  provider: provider.provider,
  clientId: provider.clientId,
  redirectUri: provider.redirectUri,
  enabled: provider.enabled,

  createdAt: provider.createdAt,
  updatedAt: provider.updatedAt
});
