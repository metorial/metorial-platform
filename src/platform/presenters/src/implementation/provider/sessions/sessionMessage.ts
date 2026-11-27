import { v } from '@lowerdeck/validation';
import { messageTranslator } from '@metorial-subspace/db';
import { Presenter } from '@metorial/presenter';
import { sessionMessageType } from '../../../types';
import { omittedBodyDescription, presentOmittedBody } from './omittedBody';
import { v1SessionErrorPresenter } from './sessionError';
import { v1SessionParticipantPresenter } from './sessionParticipant';
import { v1ProviderToolCallPresenter } from './toolCall';

export let v1SubspaceSessionMessagePresenter = Presenter.create(sessionMessageType)
  .presenter(async ({ sessionMessage }, opts) => {
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
                  streamable_http: 'streamable_http',
                  sessionless: 'sessionless'
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

      input: sessionMessage.inputOmitted
        ? presentOmittedBody(sessionMessage.inputSize)
        : sessionMessage.input
          ? ((await messageTranslator.inputToMcpBasic(
              sessionMessage.input,
              sessionMessage
            )) as Record<string, any>)
          : sessionMessage.methodOrToolKey &&
              (sessionMessage.type === 'mcp_message' || sessionMessage.type === 'tool_call')
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
      output: sessionMessage.outputOmitted
        ? presentOmittedBody(sessionMessage.outputSize)
        : sessionMessage.output
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
        description: "String representing the object’s type."
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['smg_8hJkLmNpQrStUvWx']
      }),
      type: v.enumOf(['tool_call', 'mcp_control', 'mcp_message', 'unknown'], {
        name: 'type',
        description: 'What the message carries: a tool call, connection control, or MCP protocol data.'
      }),
      status: v.enumOf(['waiting_for_response', 'failed', 'succeeded'], {
        name: 'status',
        description: '`waiting_for_response` until a reply arrives.'
      }),
      source: v.enumOf(['client', 'provider'], {
        name: 'source',
        description: 'Whether the client or the provider sent the message.'
      }),
      session_id: v.string({
        name: 'session_id',
        description: 'Session the message was sent in.',
        examples: ['ses_4dEfGhJkLmNpQrSt']
      }),
      session_provider_id: v.nullable(
        v.string({
          name: 'session_provider_id',
          description: 'Session provider that handled the message. `null` when there is none.',
          examples: ['spr_3cDeFgHjKlMnPqRs']
        })
      ),
      connection_id: v.nullable(
        v.string({
          name: 'connection_id',
          description: 'Connection the message belongs to. `null` when there is none.',
          examples: ['scn_2bCdEfGhJkLmNpQr']
        })
      ),
      provider_run_id: v.nullable(
        v.string({
          name: 'provider_run_id',
          description: 'Provider run that produced the message. `null` when there is none.',
          examples: ['prn_8hJkLmNpQrStUvWx']
        })
      ),
      hierarchy: v.object(
        {
          object: v.literal('session.message.hierarchy', {
            description: "String representing the object’s type."
          }),
          type: v.string({
            name: 'type',
            description: '`child` when the message replies to another message, `parent` otherwise.',
            examples: ['child', 'parent']
          }),
          parent_message_id: v.nullable(
            v.string({
              name: 'parent_message_id',
              description: 'Message this replies to. `null` for parent messages.'
            })
          ),
          child_message_ids: v.array(
            v.string({
              name: 'child_message_id',
              description: 'One message replying to this one.'
            }),
            {
              name: 'child_message_ids',
              description: 'Messages replying to this one.'
            }
          )
        },
        { name: 'hierarchy', description: 'Where this message sits in the reply chain.' }
      ),
      transport: v.object(
        {
          object: v.literal('session.message.transport', {
            description: "String representing the object’s type."
          }),
          type: v.enumOf(['mcp', 'tool_call', 'metorial_protocol', 'system'] as const, {
            name: 'type',
            description: 'Which channel carried the message.'
          }),
          mcp: v.nullable(
            v.object({
              object: v.literal('session.message.transport.mcp', {
                description: "String representing the object’s type."
              }),
              id: v.union([v.string(), v.number()], {
                name: 'id',
                description: 'Unique ID.'
              }),
              protocol_version: v.string({
                name: 'protocol_version',
                description: 'Negotiated MCP version, or `unknown`.'
              }),
              transport: v.string({
                name: 'transport',
                description: 'How the MCP connection is carried.',
                examples: ['unknown', 'sse', 'streamable_http', 'sessionless']
              })
            })
          ),
          tool_call: v.nullable(
            v.object({
              object: v.literal('session.message.transport.tool_call', {
                description: "String representing the object’s type."
              }),
              id: v.string({
                name: 'id',
                description: 'Unique ID.'
              })
            })
          )
        },
        { name: 'transport', description: 'How this message was delivered.' }
      ),
      input: v.nullable(
        v.record(v.any(), {
          name: 'input',
          description: `Input message data. ${omittedBodyDescription}`
        })
      ),
      output: v.nullable(
        v.record(v.any(), {
          name: 'output',
          description: `Output message data. ${omittedBodyDescription}`
        })
      ),
      tool_call: v.nullable(v1ProviderToolCallPresenter.schema),
      sender_participant: v1SessionParticipantPresenter.schema,
      responder_participant: v.nullable(v1SessionParticipantPresenter.schema),
      error: v.nullable(v1SessionErrorPresenter.schema),
      created_at: v.date({
        name: 'created_at',
        description: 'Creation time.',
        examples: [new Date('2025-09-15T10:30:00Z')]
      })
    })
  )
  .build();
