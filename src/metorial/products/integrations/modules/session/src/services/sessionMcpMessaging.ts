import { Service } from '@lowerdeck/service';
import { handleMcpRequest } from '@metorial-subspace/module-connection';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export type SessionMcpAgentClient =
  | {
      name: string;
      type: 'mcp_client_oauth';
      privateMetadata?: Record<string, any>;
      oauthRegistrationId: string;
      foreignId: string;
    }
  | {
      name: string;
      type: 'system_client';
      privateMetadata?: Record<string, any>;
      foreignId: string;
    };

class SessionMcpMessagingService {
  async send(d: {
    solutionId: string;
    tenantId: string;
    sessionId: string;
    connectionToken?: string | null;
    agentClient?: SessionMcpAgentClient;
    connectionPrivateMetadata?: Record<string, any>;
    adapter?: { identifier: string };
    message: JSONRPCMessage;
    onProgress?: (message: JSONRPCMessage) => Promise<void>;
  }) {
    let { connection, response } = await handleMcpRequest({
      solutionId: d.solutionId,
      tenantId: d.tenantId,
      sessionId: d.sessionId,
      connectionToken: d.connectionToken ?? undefined,
      agentClient: d.agentClient,
      connectionPrivateMetadata: d.connectionPrivateMetadata,
      adapter: d.adapter,
      mcpTransport: 'streamable_http',
      message: d.message,
      waitForResponse: true,
      onProgress: async message => {
        await d.onProgress?.(message);
      }
    });

    return {
      responses: response?.mcp ? [response.mcp] : [],
      sessionId: connection.session.id,
      connection: connection.connection
        ? {
            id: connection.connection.id,
            token: connection.connection.token
          }
        : null
    };
  }
}

export let sessionMcpMessagingService = Service.create(
  'sessionMcpMessagingService',
  () => new SessionMcpMessagingService()
).build();
