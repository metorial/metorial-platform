import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { sessionMessageType } from '../types';

export let v1SessionMessagePresenter = Presenter.create(sessionMessageType)
  .presenter(async ({ session, sessionMessage }, opts) => ({
    object: 'session.message',

    id: sessionMessage.id,
    type: sessionMessage.type,

    sender: {
      object: 'session.message.sender',

      type: sessionMessage.senderType,
      id: sessionMessage.senderId
    },

    mcp_message: {
      object: 'session.message.mcp_message',

      id: sessionMessage.unifiedId,
      method: sessionMessage.method,

      payload: {
        ...sessionMessage.payload,
        id:
          'id' in sessionMessage.payload ? (sessionMessage.unifiedId ?? undefined) : undefined
      } as any
    },

    session_id: session.id,
    server_session_id: sessionMessage.serverSession.id,

    created_at: sessionMessage.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('session.message'),

      id: v.string({
        name: 'id',
        description: 'Unique identifier for the session message'
      }),

      type: v.enumOf(
        ['request', 'response', 'notification', 'error', 'server_error', 'unknown', 'debug'],
        {
          name: 'type',
          description: 'Type of the session message'
        }
      ),

      sender: v.object(
        {
          object: v.literal('session.message.sender'),

          type: v.enumOf(['client', 'server'], {
            name: 'type',
            description: 'Indicates if the sender is client or server'
          }),

          id: v.string({
            name: 'id',
            description: 'Unique identifier for the sender'
          })
        },
        {
          name: 'sender',
          description: 'Information about the sender of the message'
        }
      ),

      mcp_message: v.object(
        {
          object: v.literal('session.message.mcp_message'),

          id: v.string({
            name: 'id',
            description: 'Unique identifier for the MCP message'
          }),

          method: v.string({
            name: 'method',
            description: 'Method name associated with the MCP message'
          }),

          payload: v.record(v.any(), {
            name: 'payload',
            description: 'Payload content of the MCP message'
          })
        },
        {
          name: 'mcp_message',
          description: 'Details of the MCP message'
        }
      ),

      session_id: v.string({
        name: 'session_id',
        description: 'Identifier for the related session'
      }),

      server_session_id: v.string({
        name: 'server_session_id',
        description: 'Identifier for the related server session'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the message was created'
      })
    })
  )
  .build();

export let dashboardSessionMessagePresenter = Presenter.create(sessionMessageType)
  .presenter(async ({ session, sessionMessage }, opts) => ({
    object: 'session.message',

    id: sessionMessage.id,
    type: sessionMessage.type,

    sender: {
      object: 'session.message.sender',

      type: sessionMessage.senderType,
      id: sessionMessage.senderId
    },

    mcp_message: {
      object: 'session.message.mcp_message',

      id: sessionMessage.unifiedId,
      original_id:
        sessionMessage.originalId !== null ? String(sessionMessage.originalId) : null,
      method: sessionMessage.method,

      payload: {
        ...sessionMessage.payload,
        id:
          'id' in sessionMessage.payload ? (sessionMessage.unifiedId ?? undefined) : undefined
      } as any
    },

    session_id: session.id,
    server_session_id: sessionMessage.serverSession.id,

    created_at: sessionMessage.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('session.message'),

      id: v.string(),
      type: v.enumOf([
        'request',
        'response',
        'notification',
        'error',
        'server_error',
        'unknown',
        'debug'
      ]),

      sender: v.object({
        object: v.literal('session.message.sender'),

        type: v.enumOf(['client', 'server']),
        id: v.string()
      }),

      mcp_message: v.object({
        object: v.literal('session.message.mcp_message'),

        id: v.string(),
        original_id: v.nullable(v.string()),
        method: v.string(),

        payload: v.record(v.any())
      }),

      session_id: v.string(),
      server_session_id: v.string(),

      created_at: v.date()
    })
  )
  .build();
