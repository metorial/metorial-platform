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
  ServerOAuthSetup,
  Tenant
} from '../../prisma/generated/client';
import { env } from '../env';
import { serverAuthConfigPresenter } from './serverAuthConfig';
import { serverOAuthCredentialsPresenter } from './serverOAuthCredentials';

export let serverOAuthSetupPresenter = (
  serverOAuthSetup: ServerOAuthSetup & {
    server: Server;
    tenant: Tenant;

    credentials: ServerOAuthCredentials & {
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
    };

    authConfig:
      | (ServerAuthConfig & {
          remoteOAuthConnectionAuthToken:
            | (RemoteOAuthConnectionAuthToken & {
                connectionProfile: RemoteOAuthConnectionProfile | null;
              })
            | null;

          delegatedOAuthConnectionAuthToken: DelegatedOAuthConnectionAuthToken | null;
        })
      | null;
  }
) => ({
  object: 'shuttle#server.oauth_setup',

  id: serverOAuthSetup.id,
  type: serverOAuthSetup.type,
  status: serverOAuthSetup.status,

  redirectUrl: serverOAuthSetup.redirectUri,

  url: `${env.service.PROVIDER_OAUTH_URL}/shuttle-oauth/start?setup_id=${serverOAuthSetup.id}`,

  authConfig: serverOAuthSetup.authConfig
    ? serverAuthConfigPresenter({
        ...serverOAuthSetup.authConfig,
        credentials: serverOAuthSetup.credentials,
        tenant: serverOAuthSetup.tenant,
        server: serverOAuthSetup.server
      })
    : null,

  credentials: serverOAuthCredentialsPresenter({
    ...serverOAuthSetup.credentials,
    tenant: serverOAuthSetup.tenant,
    server: serverOAuthSetup.server
  }),

  serverId: serverOAuthSetup.server.id,
  tenantId: serverOAuthSetup.tenant.id,
  credentialsId: serverOAuthSetup.credentials.id,

  createdAt: serverOAuthSetup.createdAt,
  updatedAt: serverOAuthSetup.updatedAt
});
