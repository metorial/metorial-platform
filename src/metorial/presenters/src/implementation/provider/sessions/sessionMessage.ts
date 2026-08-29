import { v } from '@lowerdeck/validation';
import { getOffloadedSessionMessage } from '@metorial-subspace/connection-utils';
import { messageTranslator } from '@metorial-subspace/db';
import { Presenter } from '@metorial/presenter';
import { sessionMessageType } from '../../../types';
import { v1SessionErrorPresenter } from './sessionError';
import { v1SessionParticipantPresenter } from './sessionParticipant';
import { v1ProviderToolCallPresenter } from './toolCall';

export let v1SubspaceSessionMessagePresenter = Presenter.create(sessionMessageType)
  .presenter(async ({ sessionMessage }, opts) => {
    if (sessionMessage.isOffloadedToStorage) {
      let offloaded = await getOffloadedSessionMessage(sessionMessage);
      if (offloaded) {
        sessionMessage.input = offloaded.input;
        sessionMessage.output = offloaded.output;
      }
    }

    return {
      object: 'session.message' as const,

      id: sessionMessage.id,
      type: sessionMessage.type,
      status: sessionMessage.status,
      source: sessionMessage.source,

      session_id: sessionMessage.session.id,
      session_provider_id: sessionMessage.sessionProvider?.id ?? null,
      connection_id: sessionMessage.connection?.id ?? null,
      provider_run_id: sessionMessage.providerRun?.id ?? null,

      hierarchy: {
        object: 'session.message.hierarchy',
        type: sessionMessage.parentMessage ? 'child' : 'parent',
        parent_message_id: sessionMessage.parentMessage?.id ?? null,
        child_message_ids: sessionMessage.childMessages.map(message => message.id)
      },

      transport: {
        object: 'session.message.transport',
        type: sessionMessage.transport,
        mcp:
          sessionMessage.transport === 'mcp'
            ? {
                object: 'session.message.transport.mcp' as const,
                id:
                  sessionMessage.input?.data?.id ??
                  sessionMessage.clientMcpId ??
                  sessionMessage.id,
                protocol_version: sessionMessage.connection?.mcpProtocolVersion ?? 'unknown',
                transport: {
                  none: 'unknown',
                  sse: 'sse',
                  streamable_http: 'streamable_http'
                }[sessionMessage.connection?.mcpTransport ?? 'none']
              }
            : null,
        // The former pre-presenter inverted this transport check; preserve its final API output.
        tool_call:
          sessionMessage.transport !== 'tool_call' && sessionMessage.toolCall?.id
            ? {
                object: 'session.message.transport.tool_call' as const,
                id: sessionMessage.toolCall.id
              }
            : null
      },

      input: sessionMessage.input
        ? ((await messageTranslator.inputToMcpBasic(
            sessionMessage.input,
            sessionMessage
          )) as Record<string, any>)
        : sessionMessage.methodOrToolKey
          ? {
              jsonrpc: '2.0',
              id: sessionMessage.clientMcpId ?? sessionMessage.id,
              method: 'tools/call',
              params: {
                name: sessionMessage.methodOrToolKey ?? 'unknown_tool',
                arguments: null
              }
            }
          : null,
      output: sessionMessage.output
        ? ((await messageTranslator.outputToMcpBasic(
            sessionMessage.output,
            sessionMessage
          )) as Record<string, any>)
        : null,

      tool_call: sessionMessage.toolCall
        ? await v1ProviderToolCallPresenter
            .present(
              {
                toolCall: {
                  ...sessionMessage.toolCall,
                  message: sessionMessage
                }
              },
              opts
            )
            .run()
        : null,

      sender_participant: await v1SessionParticipantPresenter
        .present({ sessionParticipant: sessionMessage.senderParticipant }, opts)
        .run(),

      responder_participant: sessionMessage.responderParticipant
        ? await v1SessionParticipantPresenter
            .present({ sessionParticipant: sessionMessage.responderParticipant }, opts)
            .run()
        : null,

      error: sessionMessage.error
        ? await v1SessionErrorPresenter
            .present({ sessionError: sessionMessage.error }, opts)
            .run()
        : null,

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
      type: v.enumOf(['tool_call', 'mcp_control', 'mcp_message', 'unknown'], {
        name: 'type',
        description: 'Message type'
      }),
      status: v.enumOf(['waiting_for_response', 'failed', 'succeeded'], {
        name: 'status',
        description: 'Message status'
      }),
      source: v.enumOf(['client', 'provider'], {
        name: 'source',
        description: 'Message source'
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
