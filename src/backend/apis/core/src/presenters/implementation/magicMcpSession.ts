import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { magicMcpSessionType } from '../types';

export let v1MagicMcpSessionPresenter = Presenter.create(magicMcpSessionType)
  .presenter(async ({ magicMcpSession }, opts) => {
    return {
      object: 'magic_mcp.session',

      id: magicMcpSession.id,
      session_id: magicMcpSession.session.id,

      magic_mcp_server: {
        id: magicMcpSession.magicMcpServer.id,
        status: magicMcpSession.magicMcpServer.status,

        name: magicMcpSession.magicMcpServer.name,
        description: magicMcpSession.magicMcpServer.description,
        metadata: magicMcpSession.magicMcpServer.metadata,

        created_at: magicMcpSession.magicMcpServer.createdAt,
        updated_at: magicMcpSession.magicMcpServer.updatedAt
      },

      connection_status: magicMcpSession.session.connectionStatus,

      usage: {
        total_productive_message_count:
          magicMcpSession.session.totalProductiveClientMessageCount +
          magicMcpSession.session.totalProductiveServerMessageCount,
        total_productive_client_message_count:
          magicMcpSession.session.totalProductiveClientMessageCount,
        total_productive_server_message_count:
          magicMcpSession.session.totalProductiveServerMessageCount
      },

      created_at: magicMcpSession.createdAt,
      updated_at: magicMcpSession.session.updatedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('magic_mcp.session'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the session'
      }),

      session_id: v.string({
        name: 'session_id',
        description: 'The ID of the associated session'
      }),

      connection_status: v.enumOf(['connected', 'disconnected'], {
        name: 'connection_status',
        description: 'The connection state of the session'
      }),

      magic_mcp_server: v.object({
        id: v.string({
          name: 'id',
          description: 'The unique identifier of the magic MCP server'
        }),
        status: v.enumOf(['active', 'archived', 'deleted'], {
          name: 'status',
          description: 'The status of the magic MCP server'
        }),

        name: v.string({
          name: 'name',
          description: 'The name of the magic MCP server'
        }),
        description: v.nullable(
          v.string({
            name: 'description',
            description: 'The description of the magic MCP server'
          })
        ),
        metadata: v.record(v.any(), {
          name: 'metadata',
          description: 'Additional metadata associated with the magic MCP server'
        }),

        created_at: v.date({
          name: 'created_at',
          description: 'Timestamp when the magic MCP server was created'
        }),
        updated_at: v.date({
          name: 'updated_at',
          description: 'Timestamp when the magic MCP server was last updated'
        })
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

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the session was created'
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the session was last updated'
      })
    })
  )
  .build();

export let v1DashboardMagicMcpSessionPresenter = Presenter.create(magicMcpSessionType)
  .presenter(async ({ magicMcpSession }, opts) => {
    let inner = await v1MagicMcpSessionPresenter.present({ magicMcpSession }, opts).run({});

    return {
      ...inner,
      client: magicMcpSession.session.serverSessions[0]
        ? {
            object: 'session.client#preview',
            info: magicMcpSession.session.serverSessions[0].clientInfo
          }
        : null
    };
  })
  .schema(
    v.intersection([
      v1MagicMcpSessionPresenter.schema,
      v.object({
        client: v.nullable(
          v.object({
            object: v.literal('session.client#preview'),
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
