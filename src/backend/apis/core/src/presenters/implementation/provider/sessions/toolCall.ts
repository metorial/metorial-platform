import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { toolCallType } from '../../../types';
import { v1ProviderToolPresenter } from '../provider';
import { v1SessionErrorPresenter } from './sessionError';
import { v1SessionParticipantPresenter } from './sessionParticipant';

export let v1ProviderToolCallPresenter = Presenter.create(toolCallType)
  .presenter(async ({ toolCall }, opts) => ({
    object: 'session.tool_call' as const,

    id: toolCall.id,
    tool_key: toolCall.toolKey,

    type: toolCall.type,
    status: toolCall.status,
    source: toolCall.source,

    transport: toolCall.transport,

    session_id: toolCall.sessionId,
    message_id: toolCall.messageId,
    session_provider_id: toolCall.sessionProviderId,
    connection_id: toolCall.connectionId,
    provider_run_id: toolCall.providerRunId,

    sender_participant: toolCall.senderParticipant
      ? await v1SessionParticipantPresenter
          .present({ sessionParticipant: toolCall.senderParticipant }, opts)
          .run()
      : null,
    responder_participant: toolCall.responderParticipant
      ? await v1SessionParticipantPresenter
          .present({ sessionParticipant: toolCall.responderParticipant }, opts)
          .run()
      : null,

    tool: await v1ProviderToolPresenter.present({ tool: toolCall.tool }, opts).run(),

    input: toolCall.input,
    output: toolCall.output,

    error: toolCall.error
      ? await v1SessionErrorPresenter.present({ sessionError: toolCall.error }, opts).run()
      : null,

    created_at: toolCall.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('session.tool_call', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: 'Unique tool call identifier',
        examples: ['tcl_8hJkLmNpQrStUvWx']
      }),
      tool_key: v.string({
        name: 'tool_key',
        description: 'The key identifying the tool that was called',
        examples: ['create_issue', 'search_code']
      }),

      type: v.enumOf(['tool_call', 'mcp_control', 'mcp_message', 'unknown'], {
        name: 'type',
        description: 'The type of the tool call'
      }),
      status: v.enumOf(['waiting_for_response', 'failed', 'succeeded'], {
        name: 'status',
        description: 'Current status of the tool call'
      }),
      source: v.enumOf(['client', 'provider'], {
        name: 'source',
        description: 'Source of the tool call'
      }),
      transport: v.enumOf(['tool_call', 'mcp', 'metorial_protocol', 'system'], {
        name: 'transport',
        description: 'Transport protocol used'
      }),

      session_id: v.string({
        name: 'session_id',
        description: 'Parent session ID',
        examples: ['ses_4dEfGhJkLmNpQrSt']
      }),
      message_id: v.string({
        name: 'message_id',
        description: 'Associated session message ID',
        examples: ['smg_3cDeFgHjKlMnPqRs']
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
          description: 'Session connection ID',
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
      sender_participant: v.nullable(v1SessionParticipantPresenter.schema),
      responder_participant: v.nullable(v1SessionParticipantPresenter.schema),

      tool: v1ProviderToolPresenter.schema,
      error: v.nullable(v1SessionErrorPresenter.schema),

      input: v.nullable(
        v.record(v.any(), {
          name: 'input',
          description: 'Input data passed to the tool call'
        })
      ),
      output: v.nullable(
        v.record(v.any(), {
          name: 'output',
          description: 'Output data returned from the tool call'
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
