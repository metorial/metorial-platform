import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/module-agent-tracking-query', () => ({
  maxDistinctCount: 10_000,
  maxMcpServers: 500,
  maxMcpTools: 2000,
  maxSkills: 500
}));

import {
  v1AgentTrackingMcpServerUsagePresenter,
  v1AgentTrackingSkillUsagePresenter
} from './agentTrackingTools';

let context = {
  apiVersion: 'mt_2025_01_01_dashboard',
  accessType: 'user_auth_token'
} as const;

let range = {
  preset: 'last_7_days' as const,
  from: new Date('2026-11-16T00:00:00Z'),
  to: new Date('2026-11-22T12:00:00Z'),
  timeZone: 'UTC'
};

let lastUsedAt = new Date('2026-11-21T09:30:00Z');

let figures = {
  calls: 4,
  failed: 1,
  errorRate: 0.25,
  members: 2,
  lastUsedAt
};

describe('agent tracking skill usage presenter', () => {
  it('presents the summary and the named skills', async () => {
    let presented = await v1AgentTrackingSkillUsagePresenter
      .present(
        {
          usage: {
            range,
            toolDetails: false,
            summary: { activations: 9, namedActivations: 7, members: 3, countsCapped: false },
            items: [{ name: 'pdf', activations: 7, members: 3, lastUsedAt }],
            truncated: false
          }
        },
        context
      )
      .run();

    expect(presented).toEqual({
      object: 'agent_tracking.skill_usage',
      range: {
        preset: 'last_7_days',
        from: range.from,
        to: range.to,
        time_zone: 'UTC'
      },
      tool_details: false,
      summary: { activations: 9, named_activations: 7, members: 3, counts_capped: false },
      items: [{ name: 'pdf', activations: 7, members: 3, last_used_at: lastUsedAt }],
      truncated: false
    });
  });
});

describe('agent tracking MCP server usage presenter', () => {
  it('presents the summary and the servers with their tools', async () => {
    let presented = await v1AgentTrackingMcpServerUsagePresenter
      .present(
        {
          usage: {
            range,
            toolDetails: true,
            summary: { ...figures, calls: 6, namedCalls: 4, countsCapped: true },
            items: [
              { name: 'github', ...figures, tools: [{ name: 'create_issue', ...figures }] },
              { name: 'figma', ...figures, errorRate: null, tools: [] }
            ],
            truncated: true
          }
        },
        context
      )
      .run();

    let presentedFigures = {
      calls: 4,
      failed: 1,
      error_rate: 0.25,
      members: 2,
      last_used_at: lastUsedAt
    };

    expect(presented).toEqual({
      object: 'agent_tracking.mcp_server_usage',
      range: { preset: 'last_7_days', from: range.from, to: range.to, time_zone: 'UTC' },
      tool_details: true,
      summary: { ...presentedFigures, calls: 6, named_calls: 4, counts_capped: true },
      items: [
        {
          name: 'github',
          ...presentedFigures,
          tools: [{ name: 'create_issue', ...presentedFigures }]
        },
        { name: 'figma', ...presentedFigures, error_rate: null, tools: [] }
      ],
      truncated: true
    });
  });
});
