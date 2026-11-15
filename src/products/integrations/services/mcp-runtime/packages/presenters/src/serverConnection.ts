import type {
  ServerAuthConfig,
  ServerConfig,
  ServerConnection,
  ServerInstanceConfiguration,
  ServerVersion
} from '@mtsrc/mcp-runtime-db';

export let serverConnectionPresenter = (
  serverConnection: ServerConnection & {
    serverConfig: ServerConfig;
    serverVersion: ServerVersion;
    serverAuthConfig: ServerAuthConfig | null;
    serverInstanceConfiguration: ServerInstanceConfiguration | null;
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
  serverInstanceConfigurationId: serverConnection.serverInstanceConfiguration?.id,

  createdAt: serverConnection.createdAt
});
