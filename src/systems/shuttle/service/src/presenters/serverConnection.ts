import type {
  ServerAuthConfig,
  ServerConfig,
  ServerConnection,
  ServerVersion
} from '../../prisma/generated/client';

export let serverConnectionPresenter = (
  serverConnection: ServerConnection & {
    serverConfig: ServerConfig;
    serverVersion: ServerVersion;
    serverAuthConfig: ServerAuthConfig | null;
  }
) => ({
  object: 'shuttle#server_connection',

  id: serverConnection.id,
  status: serverConnection.status,

  client: serverConnection.client,
  capabilities: serverConnection.capabilities,

  serverConfigId: serverConnection.serverConfig.id,
  serverVersionId: serverConnection.serverVersion.id,
  serverAuthConfigId: serverConnection.serverAuthConfig?.id,

  createdAt: serverConnection.createdAt
});
