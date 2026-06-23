import type {
  DelegatedOAuthConfig,
  RemoteOAuthConfig,
  Tenant
} from '../../prisma/generated/client';

export let oauthConfigPresenter = (oauthConfig: {
  remoteOauthConfig: RemoteOAuthConfig | null | undefined;
  delegatedOauthConfig: DelegatedOAuthConfig | null | undefined;
  tenant: Tenant | null;
}) => {
  if (oauthConfig.remoteOauthConfig) {
    return {
      type: 'remote' as const,
      name: oauthConfig.remoteOauthConfig.name,
      config: oauthConfig.remoteOauthConfig.config,
      scopes: oauthConfig.remoteOauthConfig.scopes,

      authConfigSchema: null,

      provider: {
        name: oauthConfig.remoteOauthConfig.providerName,
        url: oauthConfig.remoteOauthConfig.providerUrl
      },

      discovery: {
        status: oauthConfig.remoteOauthConfig.discoverStatus,
        error: oauthConfig.remoteOauthConfig.errorCode
          ? {
              code: oauthConfig.remoteOauthConfig.errorCode,
              message:
                oauthConfig.remoteOauthConfig.errorMessage ??
                oauthConfig.remoteOauthConfig.errorCode
            }
          : null,
        createdAt: oauthConfig.remoteOauthConfig.createdAt,
        lastDiscoveredAt: oauthConfig.remoteOauthConfig.lastDiscoveredAt
      }
    };
  }

  if (oauthConfig.delegatedOauthConfig) {
    return {
      type: 'delegated' as const,
      name: oauthConfig.delegatedOauthConfig.name,
      config: null,
      scopes: [],

      authConfigSchema: oauthConfig.delegatedOauthConfig.authConfigSchema,

      provider: null,

      discovery: {
        status: 'succeeded' as const,
        error: oauthConfig.delegatedOauthConfig.errorCode
          ? {
              code: oauthConfig.delegatedOauthConfig.errorCode,
              message:
                oauthConfig.delegatedOauthConfig.errorMessage ??
                oauthConfig.delegatedOauthConfig.errorCode
            }
          : null,
        createdAt: oauthConfig.delegatedOauthConfig.createdAt,
        lastDiscoveredAt: null
      }
    };
  }

  return null;
};
