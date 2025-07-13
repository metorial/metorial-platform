import { Session } from '@metorial/db';
import { v } from '@metorial/validation';

export let v1SessionPreview = Object.assign(
  (session: Session) => ({
    object: 'session#preview',

    id: session.id,

    status: session.status,
    connection_status: session.connectionStatus,

    usage: {
      total_productive_message_count:
        session.totalProductiveClientMessageCount + session.totalProductiveServerMessageCount,
      total_productive_client_message_count: session.totalProductiveClientMessageCount,
      total_productive_server_message_count: session.totalProductiveServerMessageCount
    },

    metadata: session.metadata,

    created_at: session.createdAt,
    updated_at: session.updatedAt
  }),
  {
    schema: v.object({
      object: v.literal('session#preview'),

      id: v.string({
        name: 'id',
        description: 'Unique identifier for the session preview'
      }),

      status: v.enumOf(['active', 'deleted'], {
        name: 'status',
        description: 'Current status of the session'
      }),

      connection_status: v.enumOf(['connected', 'disconnected'], {
        name: 'connection_status',
        description: 'Connection state of the session'
      }),

      usage: v.object(
        {
          total_productive_message_count: v.number({
            name: 'total_productive_message_count',
            description: 'Total count of productive messages in the session'
          }),
          total_productive_client_message_count: v.number({
            name: 'total_productive_client_message_count',
            description: 'Count of productive messages sent by the client'
          }),
          total_productive_server_message_count: v.number({
            name: 'total_productive_server_message_count',
            description: 'Count of productive messages sent by the server'
          })
        },
        {
          name: 'usage',
          description: 'Message usage statistics for the session'
        }
      ),

      metadata: v.record(v.any(), {
        name: 'metadata',
        description: 'Additional metadata related to the session'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the session was created'
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the session was last updated'
      })
    })
  }
);
