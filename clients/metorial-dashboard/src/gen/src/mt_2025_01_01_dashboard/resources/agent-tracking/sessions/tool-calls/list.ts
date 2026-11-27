import { mapObject } from '@metorial/util-resource-mapper/compact';

export type AgentTrackingSessionsToolCallsListOutput = {
  object: 'agent_tracking.session_tool_calls';
  sessionId: string;
  items: {
    object: 'agent_tracking.session_tool_call';
    occurredAt: Date;
    durationMs: number | null;
    outcome: string | null;
    toolCall: {
      id: string;
      status: 'waiting_for_response' | 'failed' | 'succeeded';
      tool: { id: string; key: string; name: string };
      provider: { id: string; name: string };
      sessionId: string;
      connectionId: string | null;
      messageId: string;
      createdAt: Date;
    };
  }[];
  unmatchedCount: number | null;
  hasMore: boolean;
};

export let mapAgentTrackingSessionsToolCallsListOutput =
  /* @__PURE__ */ mapObject<AgentTrackingSessionsToolCallsListOutput>(
    [
      'session_id',
      [
        'items',
        0,
        [
          2,
          [
            1,
            [
              'occurred_at',
              'duration_ms',
              [
                'tool_call',
                1,
                [1, ['session_id', 'connection_id', 'message_id', 'created_at']]
              ]
            ]
          ]
        ]
      ],
      'unmatched_count',
      'has_more'
    ],
    1
  );
