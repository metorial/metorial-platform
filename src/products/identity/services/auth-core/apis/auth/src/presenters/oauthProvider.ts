import type { AppOAuthProvider } from '@mtsrc/auth-core-db';

export let oauthProviderPresenter = (provider: AppOAuthProvider) => ({
  object: 'ares#oauth_provider',

  id: provider.id,

  provider: provider.provider,
  clientId: provider.clientId,
  enabled: provider.enabled,

  createdAt: provider.createdAt,
  updatedAt: provider.updatedAt
});
