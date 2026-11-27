import { db } from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import type {
  HandleMcpNotificationOrRequestParam,
  ToolInvocationCreateParam
} from '@metorial-subspace/provider-utils';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { ConnectionState } from '.';

export let getConnectionBackendConnection = async (state: ConnectionState) => {
  let backend = await getBackend({ entity: state.version });

  let adapter = state.session.adapterGlobalOid
    ? await db.providerAdapterGlobal.findUniqueOrThrow({
        where: { oid: state.session.adapterGlobalOid },
        select: { id: true, identifier: true, name: true }
      })
    : null;

  let run = await backend.providerRun.createProviderRun({
    tenant: state.instance.sessionProvider.tenant,
    providerConfigVersion: state.instance.sessionProvider.config.currentVersion!,
    providerAuthConfigVersion:
      state.instance.sessionProvider.authConfig?.currentVersion ?? null,
    providerDeployment: state.sessionProvider.deployment,

    session: state.session,
    connection: state.connection,
    participant: state.participant,
    adapter,

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

    listConnectionTools: async () => await conn.listConnectionTools(),

    getConnectionDiagnostics: async () => await conn.getConnectionDiagnostics(),

    onMcpNotificationOrRequest: (listener: (data: JSONRPCMessage) => Promise<void>) => {
      conn.onMcpNotificationOrRequest(listener);
    },

    onClose: (listener: () => Promise<void>) => {
      conn.onClose(listener);
    }
  };
};
