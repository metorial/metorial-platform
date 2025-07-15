import { ServerSession, Session } from '@metorial/db';
import { v } from '@metorial/validation';

export let v1ServerSessionPreview = Object.assign(
  (serverSession: ServerSession, session: Session) => ({
    object: 'session.server_session#preview',

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

    session_id: session.id,

    created_at: serverSession.createdAt
  }),
  {
    schema: v.object({
      object: v.literal('session.server_session#preview'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier for the server session preview'
      }),

      status: v.enumOf(['active'], {
        name: 'status',
        description: 'Current status of the server session'
      }),

      mcp: v.object(
        {
          object: v.literal('mcp'),

          version: v.string({
            name: 'version',
            description: 'The version of the MCP protocol in use'
          }),

          connection_type: v.enumOf(['sse', 'streamable_http', 'websocket'], {
            name: 'connection_type',
            description: 'The type of connection used by MCP'
          }),

          client: v.nullable(
            v.object(
              {
                object: v.literal('session.server_session.client'),

                name: v.string({
                  name: 'name',
                  description: 'Name of the client application'
                }),

                version: v.string({
                  name: 'version',
                  description: 'Version of the client application'
                }),

                capabilities: v.record(v.any(), {
                  name: 'capabilities',
                  description: 'Capabilities advertised by the client'
                })
              },
              {
                name: 'client',
                description: 'Client details connected to this session, or null if none'
              }
            )
          ),

          server: v.nullable(
            v.object(
              {
                object: v.literal('session.server_session.server'),

                name: v.string({
                  name: 'name',
                  description: 'Name of the server application'
                }),

                version: v.string({
                  name: 'version',
                  description: 'Version of the server application'
                }),

                capabilities: v.record(v.any(), {
                  name: 'capabilities',
                  description: 'Capabilities advertised by the server'
                })
              },
              {
                name: 'server',
                description: 'Server details associated with this session, or null if none'
              }
            )
          )
        },
        {
          name: 'mcp',
          description: 'MCP connection details for this session'
        }
      ),

      usage: v.object(
        {
          total_productive_message_count: v.number({
            name: 'total_productive_message_count',
            description: 'Total number of productive messages in this session'
          }),
          total_productive_client_message_count: v.number({
            name: 'total_productive_client_message_count',
            description: 'Number of productive messages sent by the client'
          }),
          total_productive_server_message_count: v.number({
            name: 'total_productive_server_message_count',
            description: 'Number of productive messages sent by the server'
          })
        },
        {
          name: 'usage',
          description: 'Usage statistics for this session'
        }
      ),

      session_id: v.string({
        name: 'session_id',
        description: 'Identifier for the related session'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the server session preview was created'
      })
    })
  }
);
