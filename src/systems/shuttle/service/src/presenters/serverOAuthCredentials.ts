import type {
  DelegatedOAuthConfig,
  DelegatedOAuthConnection,
  RemoteOAuthAutoRegistration,
  RemoteOAuthConfig,
  RemoteOAuthConnection,
  Server,
  ServerOAuthCredentials,
  Tenant
} from '../../prisma/generated/client';
import { oauthConfigPresenter } from './oauthConfig';

export let serverOAuthCredentialsPresenter = (
  serverOAuthCredentials: ServerOAuthCredentials & {
    server: Server;
    tenant: Tenant;

    remoteConnection:
      | (RemoteOAuthConnection & {
          registration: RemoteOAuthAutoRegistration | null;
          config: RemoteOAuthConfig;
        })
      | null;

    delegatedConnection:
      | (DelegatedOAuthConnection & {
          config: DelegatedOAuthConfig;
        })
      | null;
  }
) => {
  let innerConnection =
    serverOAuthCredentials.remoteConnection ?? serverOAuthCredentials.delegatedConnection;

  return {
    object: 'shuttle#server.oauth_credentials',

    id: serverOAuthCredentials.id,
    type: serverOAuthCredentials.type,

    registrationType: serverOAuthCredentials.remoteConnection?.registration
      ? ('automatic' as const)
      : ('manual' as const),

    clientId:
      innerConnection?.clientId ??
      serverOAuthCredentials.remoteConnection?.registration?.clientId ??
      null,

    oauthConfig: oauthConfigPresenter({
      tenant: serverOAuthCredentials.tenant,
      remoteOauthConfig: serverOAuthCredentials.remoteConnection?.config,
      delegatedOauthConfig: serverOAuthCredentials.delegatedConnection?.config
    }),

    provider: serverOAuthCredentials.remoteConnection
      ? {
          name:
            serverOAuthCredentials.remoteConnection?.providerName ??
            serverOAuthCredentials.remoteConnection?.config?.providerName ??
            null,
          url:
            serverOAuthCredentials.remoteConnection?.providerUrl ??
            serverOAuthCredentials.remoteConnection?.config?.providerUrl ??
            null
        }
      : null,

    discovery: {
      status: serverOAuthCredentials.remoteConnection
        ? (serverOAuthCredentials.remoteConnection?.discoveryStatus ??
          ('discovering' as const))
        : ('succeeded' as const),

      error: innerConnection?.errorCode
        ? {
            code: innerConnection?.errorCode,
            message: innerConnection?.errorMessage ?? innerConnection?.errorCode
          }
        : null,

      createdAt: innerConnection?.createdAt ?? serverOAuthCredentials.createdAt,
      lastDiscoveredAt: innerConnection?.createdAt ?? null
    },

    isDefault: serverOAuthCredentials.isDefault,

    serverId: serverOAuthCredentials.server.id,
    tenantId: serverOAuthCredentials.tenant.id,

    createdAt: serverOAuthCredentials.createdAt,
    updatedAt: serverOAuthCredentials.updatedAt
  };
};
