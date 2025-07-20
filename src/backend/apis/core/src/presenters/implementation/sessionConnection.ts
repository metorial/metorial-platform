import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { sessionConnectionType } from '../types';
import { v1ServerDeploymentPreview } from './serverDeploymentPreview';
import { v1ServerPreview } from './serverPreview';
import { v1SessionPreview } from './sessionPreview';

export let v1SessionConnectionPresenter = Presenter.create(sessionConnectionType)
  .presenter(async ({ session, sessionConnection }, opts) => {
    let serverSession = sessionConnection.serverSession;

    return {
      object: 'session.session_connection',

      id: sessionConnection.id,
      status: {
        pending: 'active',
        running: 'active',
        stopped: 'ended'
      }[serverSession.status],

      mcp: {
        object: 'mcp',

        version: serverSession.mcpVersion,
        connection_type: serverSession.mcpConnectionType,

        client: serverSession.clientInfo
          ? {
              object: 'session.session_connection.client',
              name: serverSession.clientInfo.name,
              version: serverSession.clientInfo.version,

              capabilities: serverSession.clientCapabilities ?? {}
            }
          : null,

        server: serverSession.serverInfo
          ? {
              object: 'session.session_connection.server',

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

      server: v1ServerPreview(serverSession.serverDeployment.server),

      session: v1SessionPreview(session),
      server_deployment: v1ServerDeploymentPreview(
        serverSession.serverDeployment,
        serverSession.serverDeployment.server
      ),

      created_at: sessionConnection.createdAt,
      started_at: sessionConnection.createdAt,
      ended_at: sessionConnection.endedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('session.session_connection'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier for the session connection'
      }),

      status: v.enumOf(['active', 'ended'], {
        name: 'status',
        description: 'Current status of the session connection'
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
                object: v.literal('session.session_connection.client'),

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
                object: v.literal('session.session_connection.server'),

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

      server: v1ServerPreview.schema,

      session: v1SessionPreview.schema,

      server_deployment: v1ServerDeploymentPreview.schema,

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the session connection was created'
      }),
      started_at: v.date({
        name: 'started_at',
        description: 'Timestamp when the session connection started'
      }),
      ended_at: v.nullable(
        v.date({
          name: 'ended_at',
          description: 'Timestamp when the session connection ended, or null if still active'
        })
      )
    })
  )
  .build();
