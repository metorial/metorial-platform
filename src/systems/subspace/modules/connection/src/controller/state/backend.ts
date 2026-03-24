import { getBackend } from '@metorial-subspace/provider';
import type {
  HandleMcpNotificationOrRequestParam,
  ToolInvocationCreateParam
} from '@metorial-subspace/provider-utils';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { ConnectionState } from '.';

export let getConnectionBackendConnection = async (state: ConnectionState) => {
  let backend = await getBackend({ entity: state.version });
  let run = await backend.providerRun.createProviderRun({
    tenant: state.instance.sessionProvider.tenant,
    providerConfigVersion: state.instance.sessionProvider.config.currentVersion!,
    providerAuthConfigVersion:
      state.instance.sessionProvider.authConfig?.currentVersion ?? null,
    providerDeployment: state.sessionProvider.deployment,

    session: state.session,
    connection: state.connection,
    participant: state.participant,

    providerVersion: state.version,
    provider: state.version.provider,
    providerVariant: state.version.providerVariant,

    providerRun: state.providerRun,

    mcp:
      state.connection.mcpData.capabilities && state.connection.mcpData.clientInfo
        ? {
            capabilities: state.connection.mcpData.capabilities,
            clientInfo: state.connection.mcpData.clientInfo
          }
        : null
  });

  let conn = run.connection;

  return {
    close: async () => {
      await conn.close();
    },

    sendToolInvocation: async (d: ToolInvocationCreateParam) => {
      return await conn.handleToolInvocation(d);
    },

    sendMcpResponseOrNotification: async (d: HandleMcpNotificationOrRequestParam) => {
      return await conn.handleMcpResponseOrNotification(d);
    },

    onMcpNotificationOrRequest: (listener: (data: JSONRPCMessage) => Promise<void>) => {
      conn.onMcpNotificationOrRequest(listener);
    },

    onClose: (listener: () => Promise<void>) => {
      conn.onClose(listener);
    }
  };
};
