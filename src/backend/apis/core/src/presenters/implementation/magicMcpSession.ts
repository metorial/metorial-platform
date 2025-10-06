import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { magicMcpSessionType } from '../types';

export let v1MagicMcpSessionPresenter = Presenter.create(magicMcpSessionType)
  .presenter(async ({ magicMcpSession }, opts) => {
    return {
      object: 'magic_mcp.session',

      id: magicMcpSession.id,

      magic_mcp_server_id: magicMcpSession.magicMcpServer.id,
      session_id: magicMcpSession.session.id,

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
      object: v.literal('session'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the session'
      }),

      magic_mcp_server_id: v.string({
        name: 'magic_mcp_server_id',
        description: 'The ID of the associated Magic MCP server'
      }),
      session_id: v.string({
        name: 'session_id',
        description: 'The ID of the associated session'
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
