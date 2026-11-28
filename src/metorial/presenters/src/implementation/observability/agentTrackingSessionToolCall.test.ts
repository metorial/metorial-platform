import { describe, expect, it } from 'vitest';

import {
  v1AgentTrackingSessionToolCallsPresenter,
  v1AgentTrackingToolCallSessionPresenter
} from './agentTrackingSessionToolCall';

let context = {
  apiVersion: 'mt_2025_01_01_dashboard',
  accessType: 'user_auth_token'
} as const;

let toolCall = {
  id: 'tcl_a',
  status: 'succeeded' as const,
  tool: { id: 'pto_issue', key: 'create_issue', name: 'Create Issue' },
  provider: { id: 'pro_linear', name: 'Linear' },
  sessionId: 'ses_1',
  connectionId: null,
  messageId: 'smg_1',
  createdAt: new Date('2026-11-17T09:00:01Z')
};

let session = {
  id: 'atse_c0ffee',
  state: 'ended' as const,
  member: null,
  client: { family: 'claude_code', name: 'Claude Code', surface: 'cli', version: '2.1.317' },
  models: [],
  unknownModelNames: [],
  billingModes: [],
  cost: {
    totalMicros: null,
    billedMicros: null,
    estimatedMicros: null,
    isEstimate: false,
    reportedByClientMicros: null,
    listPriceMicros: null
  },
  tokens: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0, total: 0 },
  requests: 0,
  summaryPending: false,
  context: {
    repositories: [],
    branch: 'ada/eng-12-login',
    defaultBranch: null,
    head: null,
    worktree: null,
    subPath: null,
    permissionMode: null,
    title: null,
    tickets: [{ key: 'ENG-12', url: null }],
    pullRequests: [],
    commitCount: 0,
    pullRequestCount: 0,
    lines: { added: 0, removed: 0 }
  },
  providers: [],
  startedAt: new Date('2026-11-17T09:00:00Z'),
  lastActivityAt: new Date('2026-11-17T10:00:00Z'),
  endedAt: null
};

describe('agent tracking session tool call presenters', () => {
  it('presents the matched tool calls of a session with the Metorial ids to link to', async () => {
    let presented = await v1AgentTrackingSessionToolCallsPresenter
      .present(
        {
          toolCalls: {
            sessionId: 'atse_c0ffee',
            items: [
              {
                occurredAt: new Date('2026-11-17T09:00:00Z'),
                durationMs: 120,
                outcome: 'success',
                toolCall
              }
            ],
            unmatchedCount: 2,
            hasMore: false
          }
        },
        context
      )
      .run();

    expect(presented).toEqual({
      object: 'agent_tracking.session_tool_calls',
      session_id: 'atse_c0ffee',
      items: [
        {
          object: 'agent_tracking.session_tool_call',
          occurred_at: new Date('2026-11-17T09:00:00Z'),
          duration_ms: 120,
          outcome: 'success',
          tool_call: {
            object: 'session.tool_call',
            id: 'tcl_a',
            status: 'succeeded',
            tool: { id: 'pto_issue', key: 'create_issue', name: 'Create Issue' },
            provider: { id: 'pro_linear', name: 'Linear' },
            session_id: 'ses_1',
            connection_id: null,
            message_id: 'smg_1',
            created_at: new Date('2026-11-17T09:00:01Z')
          }
        }
      ],
      unmatched_count: 2,
      has_more: false
    });
  });

  it('never presents the id the agent gave the call', async () => {
    let presented = await v1AgentTrackingSessionToolCallsPresenter
      .present(
        {
          toolCalls: {
            sessionId: 'atse_c0ffee',
            items: [{ occurredAt: new Date(), durationMs: null, outcome: null, toolCall }],
            unmatchedCount: null,
            hasMore: false
          }
        },
        context
      )
      .run();

    expect(JSON.stringify(presented)).not.toMatch(/client_call|toolu_|tool_use/);
    expect(presented.unmatched_count).toBeNull();
  });

  it('presents the agent session of a tool call as the session list does', async () => {
    let presented = await v1AgentTrackingToolCallSessionPresenter
      .present({ toolCallSession: { toolCallId: 'tcl_a', session } }, context)
      .run();

    expect(presented).toMatchObject({
      object: 'agent_tracking.tool_call_session',
      tool_call_id: 'tcl_a',
      session: {
        object: 'agent_tracking.session',
        id: 'atse_c0ffee',
        client: { family: 'claude_code', name: 'Claude Code' },
        context: { branch: 'ada/eng-12-login', title: null, tickets: [{ key: 'ENG-12' }] }
      }
    });
  });
});
