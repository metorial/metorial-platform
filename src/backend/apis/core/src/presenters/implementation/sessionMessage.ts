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
        id: 'id' in sessionMessage.payload ? sessionMessage.unifiedId : undefined
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
        method: v.string(),

        payload: v.record(v.any())
      }),

      session_id: v.string(),
      server_session_id: v.string(),

      created_at: v.date()
    })
  )
  .build();
