import type { AppOAuthProvider } from '../../../../prisma/generated/client';

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
