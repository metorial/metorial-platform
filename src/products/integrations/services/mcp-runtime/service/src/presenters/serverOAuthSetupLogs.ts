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
  ServerOAuthSetupEvent,
  Tenant
} from '../../prisma/generated/client';
import { env } from '../env';
import { serverAuthConfigPresenter } from './serverAuthConfig';
import { serverOAuthCredentialsPresenter } from './serverOAuthCredentials';

export let serverOAuthSetupLogsPresenter = (
  serverOAuthSetup: ServerOAuthSetup & {
    server: Server;
    tenant: Tenant;
    events: ServerOAuthSetupEvent[];
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
  object: 'shuttle#server.oauth_setup.logs',

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

  error:
    serverOAuthSetup.status === 'failed'
      ? {
          code: 'oauth_setup_failed',
          message: 'OAuth setup failed'
        }
      : null,

  events: serverOAuthSetup.events.map(event => ({
    object: 'shuttle#server.oauth_setup.event',
    id: event.id,
    type: event.type,
    message: event.message,
    payload: event.payload,
    functionInvocationId: event.functionInvocationId,
    serverConnectionId: event.serverConnectionId,
    createdAt: event.createdAt
  })),

  createdAt: serverOAuthSetup.createdAt,
  updatedAt: serverOAuthSetup.updatedAt
});
