import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverSessionType } from '../types';

export let v1ServerSessionPresenter = Presenter.create(serverSessionType)
  .presenter(async ({ session, serverSession }, opts) => ({
    object: 'session.server_session',

    id: serverSession.id,
    status: 'active',

    mcp: {
      object: 'mcp',

      version: serverSession.mcpVersion,
      connection_type: serverSession.mcpConnectionType,

      client: serverSession.clientInfo
        ? {
            object: 'session.server_session.client',
            name: serverSession.clientInfo.name,
            version: serverSession.clientInfo.version,

            capabilities: serverSession.clientCapabilities ?? {}
          }
        : null,

      server: serverSession.serverInfo
        ? {
            object: 'session.server_session.server',

            name: serverSession.serverInfo.name,
            version: serverSession.serverInfo.version,

            capabilities: serverSession.serverCapabilities ?? {}
          }
        : null
    },

    usage: {
      total_productive_message_count:
        serverSession.totalProductiveClientMessageCount +
        serverSession.totalProductiveServerMessageCount,
      total_productive_client_message_count: serverSession.totalProductiveClientMessageCount,
      total_productive_server_message_count: serverSession.totalProductiveServerMessageCount
    },

    server_deployment_id: serverSession.serverDeployment.id,
    session_id: session.id,

    created_at: serverSession.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('session.server_session'),

      id: v.string(),
      status: v.enumOf(['active']),

      mcp: v.object({
        object: v.literal('mcp'),

        version: v.string(),
        connection_type: v.enumOf(['sse', 'streamable_http', 'websocket']),

        client: v.nullable(
          v.object({
            object: v.literal('session.server_session.client'),
            name: v.string(),
            version: v.string(),

            capabilities: v.record(v.any())
          })
        ),

        server: v.nullable(
          v.object({
            object: v.literal('session.server_session.server'),

            name: v.string(),
            version: v.string(),

            capabilities: v.record(v.any())
          })
        )
      }),

      usage: v.object({
        total_productive_message_count: v.number(),
        total_productive_client_message_count: v.number(),
        total_productive_server_message_count: v.number()
      }),

      server_deployment_id: v.string(),
      session_id: v.string(),

      created_at: v.date()
    })
  )
  .build();
