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

      id: v.string(),
      status: v.enumOf(['active', 'deleted']),
      connection_status: v.enumOf(['connected', 'disconnected']),

      usage: v.object({
        total_productive_message_count: v.number(),
        total_productive_client_message_count: v.number(),
        total_productive_server_message_count: v.number()
      }),

      metadata: v.record(v.any()),

      created_at: v.date(),
      updated_at: v.date()
    })
  }
);
