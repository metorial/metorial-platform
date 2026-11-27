import { v } from '@lowerdeck/validation';
import type { AgentTrackingMetorialToolCall } from '@metorial/module-agent-tracking-query';
import { Presenter } from '@metorial/presenter';
import {
  agentTrackingSessionToolCallsType,
  agentTrackingToolCallSessionType
} from '../../types';
import { v1AgentTrackingSessionPresenter } from './agentTrackingSession';

let presentToolCall = (toolCall: AgentTrackingMetorialToolCall) => ({
  object: 'session.tool_call' as const,

  id: toolCall.id,
  status: toolCall.status,
  tool: { id: toolCall.tool.id, key: toolCall.tool.key, name: toolCall.tool.name },
  provider: { id: toolCall.provider.id, name: toolCall.provider.name },
  session_id: toolCall.sessionId,
  connection_id: toolCall.connectionId,
  message_id: toolCall.messageId,
  created_at: toolCall.createdAt
});

let toolCallSchema = v.object(
  {
    object: v.literal('session.tool_call', {
      description: 'String representing the object’s type.'
    }),

    id: v.string({
      name: 'id',
      description: 'Unique ID.',
      examples: ['tcl_8hJkLmNpQrStUvWx']
    }),
    status: v.enumOf(['waiting_for_response', 'failed', 'succeeded'], {
      name: 'status',
      description: '`waiting_for_response` until the tool replies.'
    }),
    tool: v.object(
      {
        id: v.string({
          name: 'id',
          description: 'Unique ID.',
          examples: ['pto_5jKlMnPqRsTuVwXy']
        }),
        key: v.string({
          name: 'key',
          description: 'Key used to call the tool over MCP.',
          examples: ['create_issue']
        }),
        name: v.string({ name: 'name', description: 'Display name.' })
      },
      { name: 'tool', description: 'Tool that was called.' }
    ),
    provider: v.object(
      {
        id: v.string({
          name: 'id',
          description: 'Unique ID.',
          examples: ['pro_2bCdEfGhJkLmNpQr']
        }),
        name: v.string({ name: 'name', description: 'Display name.' })
      },
      { name: 'provider', description: 'Provider the tool belongs to.' }
    ),
    session_id: v.string({
      name: 'session_id',
      description: 'Session the tool was called in.',
      examples: ['ses_4dEfGhJkLmNpQrSt']
    }),
    connection_id: v.nullable(
      v.string({
        name: 'connection_id',
        description: 'Connection the call belongs to. `null` when there is none.',
        examples: ['scn_2bCdEfGhJkLmNpQr']
      })
    ),
    message_id: v.string({
      name: 'message_id',
      description: 'Message that records this call.',
      examples: ['smg_3cDeFgHjKlMnPqRs']
    }),
    created_at: v.date({ name: 'created_at', description: 'Creation time.' })
  },
  { name: 'tool_call', description: 'The tool call as Metorial recorded it.' }
);

export let v1AgentTrackingSessionToolCallsPresenter = Presenter.create(
  agentTrackingSessionToolCallsType
)
  .presenter(async ({ toolCalls }) => ({
    object: 'agent_tracking.session_tool_calls' as const,

    session_id: toolCalls.sessionId,
    items: toolCalls.items.map(item => ({
      object: 'agent_tracking.session_tool_call' as const,

      occurred_at: item.occurredAt,
      duration_ms: item.durationMs,
      outcome: item.outcome,
      tool_call: presentToolCall(item.toolCall)
    })),
    unmatched_count: toolCalls.unmatchedCount,
    has_more: toolCalls.hasMore
  }))
  .schema(
    v.object({
      object: v.literal('agent_tracking.session_tool_calls', {
        description: 'String representing the object’s type.'
      }),

      session_id: v.string({
        name: 'session_id',
        description: 'Agent session the tool calls were made in.',
        examples: ['atse_3f9c2a71d04b5e8a96c1f0d2b7e4a513']
      }),
      items: v.array(
        v.object({
          object: v.literal('agent_tracking.session_tool_call', {
            description: 'String representing the object’s type.'
          }),

          occurred_at: v.date({
            name: 'occurred_at',
            description: 'When the agent reported making the call.'
          }),
          duration_ms: v.nullable(
            v.number({
              name: 'duration_ms',
              description:
                'How long the call took, in milliseconds, as the agent reported it. `null` when not reported.'
            })
          ),
          outcome: v.nullable(
            v.string({
              name: 'outcome',
              description:
                'The result of the call as the agent reported it. `null` when not reported.',
              examples: ['success', 'error']
            })
          ),
          tool_call: toolCallSchema
        }),
        {
          name: 'items',
          description:
            'MCP tool calls of the agent session linked to a Metorial tool call you can see, oldest first, one per Metorial record. Empty without the `instance.provider.session:read` scope.'
        }
      ),
      unmatched_count: v.nullable(
        v.number({
          name: 'unmatched_count',
          description:
            'MCP tool calls of the agent session that are not linked to a Metorial tool call you can see: calls to other MCP servers, and calls whose Metorial record you cannot see or no longer exists. `null` without the `instance.provider.session:read` scope.'
        })
      ),
      has_more: v.boolean({
        name: 'has_more',
        description:
          'Whether the list is cut off: the agent session made more than 500 MCP tool calls, of which only the 500 oldest are matched, or one call has more Metorial records than are listed.'
      })
    })
  )
  .build();

export let v1AgentTrackingToolCallSessionPresenter = Presenter.create(
  agentTrackingToolCallSessionType
)
  .presenter(async ({ toolCallSession }, opts) => ({
    object: 'agent_tracking.tool_call_session' as const,

    tool_call_id: toolCallSession.toolCallId,
    session: await v1AgentTrackingSessionPresenter
      .present({ session: toolCallSession.session }, opts)
      .run()
  }))
  .schema(
    v.object({
      object: v.literal('agent_tracking.tool_call_session', {
        description: 'String representing the object’s type.'
      }),

      tool_call_id: v.string({
        name: 'tool_call_id',
        description: 'Tool call the agent session made.',
        examples: ['tcl_8hJkLmNpQrStUvWx']
      }),
      session: v1AgentTrackingSessionPresenter.schema
    })
  )
  .build();
