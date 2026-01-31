import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { subspaceSessionMessageType } from '../../types';

export let v1SubspaceSessionMessagePresenter = Presenter.create(subspaceSessionMessageType)
  .presenter(async ({ sessionMessage }) => ({
    object: 'session.message' as const,
    id: sessionMessage.id,
    type: sessionMessage.type,
    sender: {
      object: 'session.message.sender' as const,
      type: sessionMessage.senderType,
      id: sessionMessage.senderId
    },
    method: sessionMessage.method,
    unified_id: sessionMessage.unifiedId,
    payload: sessionMessage.payload,
    session_id: sessionMessage.sessionId,
    session_provider_id: sessionMessage.sessionProviderId,
    provider_run_id: sessionMessage.providerRunId,
    created_at: sessionMessage.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('session.message', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique session message identifier',
        examples: ['smg_8hJkLmNpQrStUvWx']
      }),
      type: v.nullable(
        v.string({
          name: 'type',
          description: 'Message type',
          examples: ['request', 'response', 'notification']
        })
      ),
      sender: v.object(
        {
          object: v.literal('session.message.sender', {
            description: "String representing the object's type"
          }),
          type: v.nullable(
            v.string({
              name: 'type',
              description: 'Sender type',
              examples: ['client', 'server']
            })
          ),
          id: v.nullable(
            v.string({
              name: 'id',
              description: 'Sender ID',
              examples: ['spr_3cDeFgHjKlMnPqRs']
            })
          )
        },
        { name: 'sender', description: 'Message sender information' }
      ),
      method: v.nullable(
        v.string({
          name: 'method',
          description: 'MCP method name',
          examples: ['tools/list', 'tools/call']
        })
      ),
      unified_id: v.nullable(
        v.string({
          name: 'unified_id',
          description: 'Unified message ID for request/response correlation',
          examples: ['msg_4dEfGhJkLmNpQrSt']
        })
      ),
      payload: v.nullable(
        v.record(v.any(), {
          name: 'payload',
          description: 'Message payload',
          examples: [{ jsonrpc: '2.0', method: 'tools/list' }]
        })
      ),
      session_id: v.string({
        name: 'session_id',
        description: 'Parent session ID',
        examples: ['ses_4dEfGhJkLmNpQrSt']
      }),
      session_provider_id: v.nullable(
        v.string({
          name: 'session_provider_id',
          description: 'Session provider ID',
          examples: ['spr_3cDeFgHjKlMnPqRs']
        })
      ),
      provider_run_id: v.nullable(
        v.string({
          name: 'provider_run_id',
          description: 'Provider run ID',
          examples: ['prn_8hJkLmNpQrStUvWx']
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      })
    })
  )
  .build();
