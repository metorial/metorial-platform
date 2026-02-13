import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { magicMcpSessionType } from '../types';

export let v1MagicMcpSessionPresenter = Presenter.create(magicMcpSessionType)
  .presenter(async ({ magicMcpSession }) => {
    return {
      object: 'magic_mcp.session',

      id: magicMcpSession.id,
      subspace_session_id: magicMcpSession.subspaceSession.id,

      magic_mcp_server: {
        id: magicMcpSession.magicMcpServer.id,
        status: magicMcpSession.magicMcpServer.status,

        name: magicMcpSession.magicMcpServer.name,
        description: magicMcpSession.magicMcpServer.description,
        metadata: magicMcpSession.magicMcpServer.metadata,

        created_at: magicMcpSession.magicMcpServer.createdAt,
        updated_at: magicMcpSession.magicMcpServer.updatedAt
      },

      connection_status: magicMcpSession.subspaceSession.connectionState,
      connection_count: magicMcpSession.connectionCount,

      usage: {
        total_productive_message_count:
          magicMcpSession.subspaceSession.usage.totalProductiveClientMessageCount +
          magicMcpSession.subspaceSession.usage.totalProductiveServerMessageCount,
        total_productive_client_message_count:
          magicMcpSession.subspaceSession.usage.totalProductiveClientMessageCount,
        total_productive_server_message_count:
          magicMcpSession.subspaceSession.usage.totalProductiveServerMessageCount
      },

      last_active_at: magicMcpSession.subspaceSession.lastActiveAt ?? null,
      created_at: magicMcpSession.createdAt,
      updated_at: magicMcpSession.updatedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('magic_mcp.session'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the session mapping'
      }),

      subspace_session_id: v.string({
        name: 'subspace_session_id',
        description: 'The ID of the associated Subspace session'
      }),

      connection_status: v.string({
        name: 'connection_status',
        description: 'The connection state of the Subspace session'
      }),

      connection_count: v.number({
        name: 'connection_count',
        description: 'Number of active/known Subspace connections for the session'
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

        name: v.nullable(
          v.string({
            name: 'name',
            description: 'The name of the magic MCP server'
          })
        ),
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

      last_active_at: v.nullable(
        v.date({
          name: 'last_active_at',
          description: 'Timestamp for the most recent activity on the Subspace session'
        })
      ),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the mapping was created'
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the mapping was last updated'
      })
    })
  )
  .build();

export let v1DashboardMagicMcpSessionPresenter = Presenter.create(magicMcpSessionType)
  .presenter(async ({ magicMcpSession }, opts) => {
    return await v1MagicMcpSessionPresenter.present({ magicMcpSession }, opts).run({});
  })
  .schema(v1MagicMcpSessionPresenter.schema)
  .build();
