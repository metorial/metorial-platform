import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { subspaceSessionMessageType } from '../../types';

export let v1SubspaceSessionMessagePresenter = Presenter.create(subspaceSessionMessageType)
  .presenter(async ({ sessionMessage }) => {
    let method =
      ((sessionMessage.input as Record<string, unknown> | null)?.method as string | null) ??
      null;

    let payload =
      sessionMessage.source === 'provider'
        ? (sessionMessage.output ?? sessionMessage.input)
        : (sessionMessage.input ?? sessionMessage.output);

    let mcpId = sessionMessage.transport?.mcp?.id ?? sessionMessage.id;

    return {
      object: 'session.message' as const,
      id: sessionMessage.id,
      type: sessionMessage.type ?? sessionMessage.source ?? 'unknown',
      sender: {
        object: 'session.message.sender' as const,
        type: sessionMessage.source ?? 'client',
        id: sessionMessage.senderParticipant?.id ?? null
      },
      mcp_message: {
        object: 'session.message.mcp_message' as const,
        id: mcpId,
        original_id: null as string | null,
        method,
        payload: payload ?? {}
      },
      session_id: sessionMessage.sessionId,
      server_session_id:
        sessionMessage.connectionId ??
        sessionMessage.sessionProviderId ??
        sessionMessage.sessionId,
      created_at: sessionMessage.createdAt
    };
  })
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
      mcp_message: v.object(
        {
          object: v.literal('session.message.mcp_message', {
            description: "String representing the object's type"
          }),
          id: v.string({
            name: 'id',
            description: 'Unified message ID for request/response correlation'
          }),
          original_id: v.nullable(
            v.string({
              name: 'original_id',
              description: 'Original message ID from the client'
            })
          ),
          method: v.nullable(
            v.string({
              name: 'method',
              description: 'MCP method name',
              examples: ['tools/list', 'tools/call']
            })
          ),
          payload: v.nullable(
            v.record(v.any(), {
              name: 'payload',
              description: 'Message payload',
              examples: [{ jsonrpc: '2.0', method: 'tools/list' }]
            })
          )
        },
        {
          name: 'mcp_message',
          description: 'Details of the MCP message'
        }
      ),
      session_id: v.string({
        name: 'session_id',
        description: 'Parent session ID',
        examples: ['ses_4dEfGhJkLmNpQrSt']
      }),
      server_session_id: v.string({
        name: 'server_session_id',
        description: 'Server session / session provider ID',
        examples: ['spr_3cDeFgHjKlMnPqRs']
      }),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      })
    })
  )
  .build();
