import { Presenter } from '@lowerdeck/presenter';
import { v } from '@lowerdeck/validation';
import { toolCallType } from '../../types';
import { v1ProviderToolPresenter } from './providerTool';
import { v1SessionErrorPresenter } from './sessionError';

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

      type: v.string({
        name: 'type',
        description: 'The type of the tool call',
        examples: ['tool_call']
      }),
      status: v.string({
        name: 'status',
        description: 'Current status of the tool call',
        examples: ['waiting_for_response', 'succeeded', 'failed']
      }),
      source: v.string({
        name: 'source',
        description: 'Source of the tool call',
        examples: ['client', 'provider']
      }),
      transport: v.string({
        name: 'transport',
        description: 'Transport protocol used',
        examples: ['tool_call', 'mcp', 'metorial_protocol', 'system']
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
