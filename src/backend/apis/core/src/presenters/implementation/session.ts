import { getConfig } from '@metorial/config';
import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { sessionType } from '../types';
import { v1ServerPreview } from './serverPreview';

export let v1SessionPresenter = Presenter.create(sessionType)
  .presenter(async ({ session }, opts) => {
    return {
      object: 'session',

      id: session.id,

      status: session.status,
      connection_status: session.connectionStatus,

      usage: {
        total_productive_message_count:
          session.totalProductiveClientMessageCount +
          session.totalProductiveServerMessageCount,
        total_productive_client_message_count: session.totalProductiveClientMessageCount,
        total_productive_server_message_count: session.totalProductiveServerMessageCount
      },

      metadata: session.metadata ?? {},

      created_at: session.createdAt,
      updated_at: session.updatedAt,

      client_secret: {
        object: 'client_secret',

        type: 'session' as const,
        id: session.clientSecretId,
        secret: session.clientSecretValue,
        expires_at: session.clientSecretExpiresAt
      },

      server_deployments: session.serverDeployments.map(
        ({ serverDeployment: deployment, oauthSession }) => ({
          object: 'session.server_deployment#preview',

          id: deployment.id,
          name: deployment.name,
          description: deployment.description,

          metadata: deployment.server.metadata ?? {},

          oauth_session_id: oauthSession?.id ?? null,

          connection_urls: {
            sse: `${getConfig().urls.mcpUrl}/mcp/${session.id}/${deployment.id}/sse`,
            streamable_http: `${getConfig().urls.mcpUrl}/mcp/${session.id}/${deployment.id}/mcp`
            // websocket: `${getConfig().urls.mcpUrl}/mcp/${session.id}/${deployment.id}/websocket`
          },

          created_at: deployment.createdAt,
          updated_at: deployment.updatedAt,

          server: v1ServerPreview(deployment.server)
        })
      )
    };
  })
  .schema(
    v.object({
      object: v.literal('session', { description: "String representing the object's type" }),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the session'
      }),

      status: v.enumOf(['active', 'deleted'], {
        name: 'status',
        description: 'The current status of the session'
      }),

      connection_status: v.enumOf(['connected', 'disconnected'], {
        name: 'connection_status',
        description: 'The connection state of the session'
      }),

      usage: v.object(
        {
          total_productive_message_count: v.number({
            name: 'total_productive_message_count',
            description: 'Total number of productive messages sent in the session'
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
          description: 'Usage statistics for the session'
        }
      ),

      metadata: v.record(v.any(), {
        name: 'metadata',
        description: 'Additional metadata associated with the session'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the session was created',
        examples: [new Date('2024-01-15T09:30:00Z')]
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the session was last updated',
        examples: [new Date('2024-01-15T09:30:00Z')]
      }),

      client_secret: v.object(
        {
          object: v.literal('client_secret', { description: "String representing the object's type" }),

          type: v.enumOf(['session'], {
            name: 'type',
            description: 'The type of client secret'
          }),
          id: v.string({
            name: 'id',
            description: 'The unique identifier of the client secret'
          }),
          secret: v.string({
            name: 'secret',
            description: 'The secret token for the session client'
          }),
          expires_at: v.date({
            name: 'expires_at',
            description: 'Expiration date of the client secret',
            examples: [new Date('2024-01-15T09:30:00Z')]
          })
        },
        {
          name: 'client_secret',
          description: 'Client secret object associated with this session'
        }
      ),

      server_deployments: v.array(
        v.object({
          object: v.literal('session.server_deployment#preview', { description: "String representing the object's type" }),

          id: v.string({
            name: 'id',
            description: 'The unique identifier of the server deployment preview'
          }),

          name: v.nullable(
            v.string({
              name: 'name',
              description: 'The name of the server deployment preview, if available'
            })
          ),

          description: v.nullable(
            v.string({
              name: 'description',
              description: 'A description of the server deployment preview, if available'
            })
          ),

          metadata: v.record(v.any(), {
            name: 'metadata',
            description: 'Additional metadata related to the server deployment preview'
          }),

          oauth_session_id: v.nullable(
            v.string({
              name: 'oauth_session_id',
              description: 'The associated OAuth session ID, if available'
            })
          ),

          connection_urls: v.object(
            {
              sse: v.string({
                name: 'sse',
                description: 'URL for Server-Sent Events connection'
              }),
              streamable_http: v.string({
                name: 'streamable_http',
                description: 'URL for Streamable HTTP connection'
              })
              // websocket: v.string({
              //   name: 'websocket',
              //   description: 'URL for WebSocket connection'
              // })
            },
            {
              name: 'url',
              description: 'Connection URLs for the server deployment'
            }
          ),

          created_at: v.date({
            name: 'created_at',
            description: 'Timestamp when the server deployment preview was created',
            examples: [new Date('2024-01-15T09:30:00Z')]
          }),

          updated_at: v.date({
            name: 'updated_at',
            description: 'Timestamp when the server deployment preview was last updated',
            examples: [new Date('2024-01-15T09:30:00Z')]
          }),

          server: v1ServerPreview.schema
        }),
        {
          name: 'server_deployments',
          description: 'List of server deployments related to this session'
        }
      )
    })
  )
  .build();

export let v1DashboardSessionPresenter = Presenter.create(sessionType)
  .presenter(async ({ session }, opts) => {
    let inner = await v1SessionPresenter.present({ session }, opts).run({});

    return {
      ...inner,
      client: session.serverSessions[0]
        ? {
            object: 'session.client#preview',
            info: session.serverSessions[0].clientInfo
          }
        : null
    };
  })
  .schema(
    v.intersection([
      v1SessionPresenter.schema,
      v.object({
        client: v.nullable(
          v.object({
            object: v.literal('session.client#preview', { description: "String representing the object's type" }),
            info: v.object({
              name: v.string({
                name: 'name',
                description: 'Name of the client'
              }),
              version: v.string({
                name: 'version',
                description: 'Version of the client'
              })
            })
          })
        )
      })
    ]) as any
  )
  .build();
