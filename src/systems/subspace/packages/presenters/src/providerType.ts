import {
  getOAuthCallbackUrl,
  type Provider,
  type ProviderType,
  type Tenant
} from '@metorial-subspace/db';

let mapAuth = (
  auth: ProviderType['attributes']['auth'],
  providerType: ProviderType,
  provider: Provider,
  tenant: Tenant | undefined
) => {
  if (auth.status === 'disabled') return auth;

  return {
    ...auth,
    oauth:
      auth.oauth.status === 'enabled'
        ? {
            ...auth.oauth,
            oauthCallbackUrl: tenant
              ? getOAuthCallbackUrl(providerType, provider, tenant)
              : null
          }
        : auth.oauth
  };
};

export let providerTypePresenter = (
  providerType: ProviderType,
  d: { tenant: Tenant | undefined; provider: Provider }
) => ({
  object: 'provider.type',

  id: providerType.id,
  name: providerType.name,

  config: providerType.attributes.config,
  triggers: providerType.attributes.triggers,
  auth: mapAuth(providerType.attributes.auth, providerType, d.provider, d.tenant),

  createdAt: providerType.createdAt
});
