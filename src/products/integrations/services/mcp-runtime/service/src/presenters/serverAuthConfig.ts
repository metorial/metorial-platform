import type {
  DelegatedOAuthConfig,
  DelegatedOAuthConnection,
  DelegatedOAuthConnectionAuthToken,
  RemoteOAuthAutoRegistration,
  RemoteOAuthConfig,
  RemoteOAuthConnection,
  RemoteOAuthConnectionAuthToken,
  RemoteOAuthConnectionProfile,
  Server,
  ServerAuthConfig,
  ServerOAuthCredentials,
  Tenant
} from '../../prisma/generated/client';
import { serverOAuthCredentialsPresenter } from './serverOAuthCredentials';

export let serverAuthConfigPresenter = (
  serverAuthConfig: ServerAuthConfig & {
    server: Server;
    tenant: Tenant;

    credentials:
      | (ServerOAuthCredentials & {
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
        })
      | null;

    remoteOAuthConnectionAuthToken:
      | (RemoteOAuthConnectionAuthToken & {
          connectionProfile: RemoteOAuthConnectionProfile | null;
        })
      | null;

    delegatedOAuthConnectionAuthToken: DelegatedOAuthConnectionAuthToken | null;
  }
) => ({
  object: 'shuttle#server.auth_config',

  id: serverAuthConfig.id,
  type: serverAuthConfig.type,
  source: serverAuthConfig.remoteOAuthConnectionAuthToken?.source ?? 'oauth',

  authConfig: serverAuthConfig.delegatedOAuthConnectionAuthToken?.authConfigValue ?? {},

  credentials: serverAuthConfig.credentials
    ? serverOAuthCredentialsPresenter({
        ...serverAuthConfig.credentials,
        server: serverAuthConfig.server,
        tenant: serverAuthConfig.tenant
      })
    : null,

  profile: serverAuthConfig.remoteOAuthConnectionAuthToken?.connectionProfile
    ? {
        id: serverAuthConfig.remoteOAuthConnectionAuthToken?.connectionProfile?.sub,
        email: serverAuthConfig.remoteOAuthConnectionAuthToken?.connectionProfile?.email,
        name: serverAuthConfig.remoteOAuthConnectionAuthToken?.connectionProfile?.name,
        data: serverAuthConfig.remoteOAuthConnectionAuthToken?.connectionProfile?.rawProfile
      }
    : null,

  serverId: serverAuthConfig.server.id,
  tenantId: serverAuthConfig.tenant.id,

  createdAt: serverAuthConfig.createdAt,
  updatedAt: serverAuthConfig.updatedAt
});
