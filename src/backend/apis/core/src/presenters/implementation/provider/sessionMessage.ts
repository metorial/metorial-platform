import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sessionMessageType } from '../../types';
import { v1SessionErrorPresenter } from './sessionError';
import { v1SessionParticipantPresenter } from './sessionParticipant';
import { v1ProviderToolCallPresenter } from './toolCall';

export let v1SubspaceSessionMessagePresenter = Presenter.create(sessionMessageType)
  .presenter(async ({ sessionMessage }, opts) => ({
    object: 'session.message' as const,

    id: sessionMessage.id,
    type: sessionMessage.type,
    status: sessionMessage.status,
    source: sessionMessage.source,

    session_id: sessionMessage.sessionId,
    session_provider_id: sessionMessage.sessionProviderId,
    connection_id: sessionMessage.connectionId,
    provider_run_id: sessionMessage.providerRunId,

    hierarchy: {
      object: 'session.message.hierarchy',
      type: sessionMessage.hierarchy.type,
      parent_message_id: sessionMessage.hierarchy.parentMessageId ?? null,
      child_message_ids: sessionMessage.hierarchy.childMessageIds
    },

    transport: {
      object: 'session.message.transport',
      type: sessionMessage.transport.type,
      mcp: sessionMessage.transport.mcp
        ? {
            object: 'session.message.transport.mcp' as const,
            id: sessionMessage.transport.mcp.id,
            protocol_version: sessionMessage.transport.mcp.protocolVersion,
            transport: sessionMessage.transport.mcp.transport
          }
        : null,
      tool_call: sessionMessage.transport.toolCall?.id
        ? {
            object: 'session.message.transport.tool_call' as const,
            id: sessionMessage.transport.toolCall.id
          }
        : null
    },

    input: sessionMessage.input as Record<string, any> | null,
    output: sessionMessage.output as Record<string, any> | null,

    tool_call: sessionMessage.toolCall
      ? await v1ProviderToolCallPresenter
          .present({ toolCall: sessionMessage.toolCall as any }, opts)
          .run()
      : null,

    sender_participant: await v1SessionParticipantPresenter
      .present({ sessionParticipant: sessionMessage.senderParticipant as any }, opts)
      .run(),

    responder_participant: sessionMessage.responderParticipant
      ? await v1SessionParticipantPresenter
          .present({ sessionParticipant: sessionMessage.responderParticipant as any }, opts)
          .run()
      : null,

    error: sessionMessage.error
      ? await v1SessionErrorPresenter
          .present({ sessionError: sessionMessage.error }, opts)
          .run()
      : null,

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
      type: v.string({
        name: 'type',
        description: 'Message type',
        examples: ['tool_call', 'mcp_control', 'mcp_message']
      }),
      status: v.string({
        name: 'status',
        description: 'Message status',
        examples: ['waiting_for_response', 'succeeded', 'failed']
      }),
      source: v.string({
        name: 'source',
        description: 'Message source',
        examples: ['client', 'provider']
      }),
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
      connection_id: v.nullable(
        v.string({
          name: 'connection_id',
          description: 'Connection ID',
          examples: ['scn_2bCdEfGhJkLmNpQr']
        })
      ),
      provider_run_id: v.nullable(
        v.string({
          name: 'provider_run_id',
          description: 'Provider run ID',
          examples: ['prn_8hJkLmNpQrStUvWx']
        })
      ),
      hierarchy: v.object(
        {
          object: v.literal('session.message.hierarchy'),
          type: v.string({
            name: 'type',
            description: 'Hierarchy type',
            examples: ['child', 'parent']
          }),
          parent_message_id: v.nullable(
            v.string({
              name: 'parent_message_id',
              description: 'Parent message ID'
            })
          ),
          child_message_ids: v.array(
            v.string({
              name: 'child_message_id',
              description: 'Child message ID'
            }),
            {
              name: 'child_message_ids',
              description: 'List of child message IDs'
            }
          )
        },
        { name: 'hierarchy', description: 'Message hierarchy information' }
      ),
      transport: v.object(
        {
          object: v.literal('session.message.transport'),
          type: v.enumOf(['mcp', 'tool_call', 'metorial_protocol', 'system'] as const, {
            name: 'type',
            description: 'Transport type'
          }),
          mcp: v.nullable(
            v.object({
              object: v.literal('session.message.transport.mcp'),
              id: v.union([v.string(), v.number()], {
                name: 'id',
                description: 'MCP message ID'
              }),
              protocol_version: v.string({
                name: 'protocol_version',
                description: 'MCP protocol version'
              }),
              transport: v.string({
                name: 'transport',
                description: 'MCP transport type',
                examples: ['unknown', 'sse', 'streamable_http']
              })
            })
          ),
          tool_call: v.nullable(
            v.object({
              object: v.literal('session.message.transport.tool_call'),
              id: v.string({
                name: 'id',
                description: 'Tool call ID'
              })
            })
          )
        },
        { name: 'transport', description: 'Transport information' }
      ),
      input: v.nullable(
        v.record(v.any(), {
          name: 'input',
          description: 'Input message data'
        })
      ),
      output: v.nullable(
        v.record(v.any(), {
          name: 'output',
          description: 'Output message data'
        })
      ),
      tool_call: v.nullable(v1ProviderToolCallPresenter.schema),
      sender_participant: v1SessionParticipantPresenter.schema,
      responder_participant: v.nullable(v1SessionParticipantPresenter.schema),
      error: v.nullable(v1SessionErrorPresenter.schema),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      })
    })
  )
  .build();
