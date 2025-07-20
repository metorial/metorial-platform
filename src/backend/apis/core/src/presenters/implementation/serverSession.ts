import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverSessionType } from '../types';
import { v1ServerDeploymentPreview } from './serverDeploymentPreview';
import { v1ServerPreview } from './serverPreview';
import { v1SessionPreview } from './sessionPreview';

export let v1ServerSessionPresenter = Presenter.create(serverSessionType)
  .presenter(async ({ session, serverSession }, opts) => ({
    object: 'session.server_session',

    id: serverSession.id,
    status: serverSession.status,

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

    server: v1ServerPreview(serverSession.serverDeployment.server),

    session: v1SessionPreview(session),
    server_deployment: v1ServerDeploymentPreview(
      serverSession.serverDeployment,
      serverSession.serverDeployment.server
    ),

    connection: serverSession.sessionConnection
      ? {
          object: 'session.session_connection#preview',

          id: serverSession.sessionConnection.id,

          client: {
            user_agent: serverSession.sessionConnection.userAgent,
            anonymized_ip_address: serverSession.sessionConnection.anonIp
          },

          created_at: serverSession.sessionConnection.createdAt,
          started_at: serverSession.sessionConnection.createdAt,
          ended_at: serverSession.sessionConnection.endedAt
        }
      : null,

    created_at: serverSession.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('session.server_session'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier for the server session'
      }),

      status: v.enumOf(['pending', 'running', 'stopped'], {
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

      server: v1ServerPreview.schema,

      session: v1SessionPreview.schema,

      server_deployment: v1ServerDeploymentPreview.schema,

      connection: v.nullable(
        v.object({
          object: v.literal('session.session_connection#preview'),

          id: v.string({
            name: 'id',
            description: 'The unique identifier for the session connection'
          }),

          client: v.object({
            user_agent: v.string({
              name: 'user_agent',
              description: 'User agent string of the client'
            }),
            anonymized_ip_address: v.string({
              name: 'anonymized_ip_address',
              description: 'Anonymized IP address of the client'
            })
          }),

          created_at: v.date({
            name: 'created_at',
            description: 'Timestamp when the server session was created'
          }),
          started_at: v.date({
            name: 'started_at',
            description: 'Timestamp when the session connection started'
          }),
          ended_at: v.nullable(
            v.date({
              name: 'ended_at',
              description:
                'Timestamp when the session connection ended, or null if still active'
            })
          )
        })
      ),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the server session was created'
      })
    })
  )
  .build();
