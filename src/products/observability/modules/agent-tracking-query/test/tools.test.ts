import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agentTrackingToolService } from '../src/services/agentTrackingTool';
import { callsTo, desktop, privacy, rejection, resetMocks, rpc, scope } from './_mocks';

let now = new Date('2026-11-22T12:00:00Z');

type Result = { rows: Record<string, unknown>[]; meta?: Record<string, unknown> };

let answer = (results: (query: any) => Result) => {
  rpc.handlers['query:run'] = (({ query }: any) => ({
    totals: null,
    labels: {},
    meta: {},
    ...results(query)
  })) as any;
};

let dimensionsOf = (query: any) =>
  (query.dimensions ?? []).map((dimension: any) => dimension.field ?? dimension).join(',');

let calls = (calls: number, extra: Record<string, unknown> = {}) => ({
  tool_calls: calls,
  'tool_calls.failed': 1,
  'tool_calls.error_rate': 1 / calls,
  'users.active': 2,
  last_used: '2026-11-21T09:30:00+00:00',
  ...extra
});

beforeEach(() => {
  resetMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
});

afterEach(() => vi.useRealTimers());

describe('skill usage', () => {
  it('lists skills by their named activations with the totals of all activations', async () => {
    desktop.toolDetails = true;
    answer(query => {
      if (dimensionsOf(query) == 'skill.name') {
        return {
          rows: [
            {
              'skill.name': 'pdf',
              'skill_activations.named': 7,
              'users.active': 3,
              last_used: '2026-11-21T09:30:00+00:00'
            }
          ],
          meta: { truncated: true }
        };
      }

      return {
        rows: [{ skill_activations: 12, 'skill_activations.named': 7, 'users.active': 4 }],
        meta: { warnings: [{ code: 'distinct_capped' }] }
      };
    });

    let usage = await agentTrackingToolService.getSkillUsage({
      ...scope,
      range: { preset: 'last_7_days', timeZone: 'Europe/Berlin' }
    });

    let queries = callsTo('query:run').map(call => call.input.query);
    expect(queries.map(query => query.dataset)).toEqual([
      'skill_activations',
      'skill_activations'
    ]);
    expect(queries[0]).toMatchObject({
      measures: ['skill_activations', 'skill_activations.named', 'users.active']
    });
    expect(queries[1]).toMatchObject({
      dimensions: [{ field: 'skill.name', missing: 'exclude' }],
      measures: ['skill_activations.named', 'users.active', 'last_used'],
      having: { field: 'skill_activations.named', op: 'gt', value: 0 },
      timeZone: 'Europe/Berlin',
      limit: 500
    });

    expect(usage).toMatchObject({
      range: { preset: 'last_7_days', timeZone: 'Europe/Berlin', to: now },
      toolDetails: true,
      summary: { activations: 12, namedActivations: 7, members: 4, countsCapped: true },
      items: [
        {
          name: 'pdf',
          activations: 7,
          members: 3,
          lastUsedAt: new Date('2026-11-21T09:30:00Z')
        }
      ],
      truncated: true
    });
  });
});

describe('MCP server usage', () => {
  it('lists servers with their tools and failure rates', async () => {
    answer(query => {
      let dimensions = dimensionsOf(query);
      if (dimensions == 'mcp.server') {
        return {
          rows: [
            { 'mcp.server': 'github', ...calls(4) },
            {
              'mcp.server': 'figma',
              ...calls(2, { 'tool_calls.failed': 0, 'tool_calls.error_rate': 0 })
            }
          ]
        };
      }
      if (dimensions == 'mcp.server,mcp.tool') {
        return {
          rows: [
            { 'mcp.server': 'github', 'mcp.tool': 'create_issue', ...calls(3) },
            { 'mcp.server': 'github', 'mcp.tool': 'search', ...calls(1) },
            { 'mcp.server': 'figma', 'mcp.tool': 'get_file', ...calls(2) }
          ]
        };
      }

      return {
        rows: [
          {
            mcp_calls: 10,
            'mcp_calls.failed': 2,
            'mcp_calls.error_rate': 0.2,
            'mcp_calls.named': 6,
            'mcp_calls.users': 3,
            'mcp_calls.last_used': '2026-11-21T09:30:00+00:00'
          }
        ]
      };
    });

    let usage = await agentTrackingToolService.getMcpServerUsage({
      ...scope,
      range: { preset: 'last_30_days' }
    });

    let queries = callsTo('query:run').map(call => call.input.query);
    expect(queries.map(dimensionsOf)).toEqual(['', 'mcp.server', 'mcp.server,mcp.tool']);
    expect(queries[0]).not.toHaveProperty('where');
    expect(queries[0]).toMatchObject({
      measures: [
        'mcp_calls',
        'mcp_calls.failed',
        'mcp_calls.error_rate',
        'mcp_calls.users',
        'mcp_calls.last_used',
        'mcp_calls.named'
      ]
    });
    for (let query of queries.slice(1)) {
      expect(query).toMatchObject({
        dataset: 'tool_calls',
        where: { field: 'tool.kind', op: 'eq', value: 'mcp' },
        measures: [
          'tool_calls',
          'tool_calls.failed',
          'tool_calls.error_rate',
          'users.active',
          'last_used'
        ]
      });
    }

    expect(usage.toolDetails).toBe(false);
    expect(usage.summary).toEqual({
      calls: 10,
      failed: 2,
      errorRate: 0.2,
      members: 3,
      lastUsedAt: new Date('2026-11-21T09:30:00Z'),
      namedCalls: 6,
      countsCapped: false
    });
    expect(usage.items).toMatchObject([
      {
        name: 'github',
        calls: 4,
        failed: 1,
        errorRate: 0.25,
        tools: [
          { name: 'create_issue', calls: 3 },
          { name: 'search', calls: 1 }
        ]
      },
      { name: 'figma', errorRate: 0, tools: [{ name: 'get_file' }] }
    ]);
    expect(usage.truncated).toBe(false);
  });

  it('presents an empty instance with a null rate', async () => {
    answer(() => ({ rows: [] }));

    let usage = await agentTrackingToolService.getMcpServerUsage({ ...scope, range: {} });

    expect(usage.summary).toMatchObject({ calls: 0, errorRate: null, lastUsedAt: null });
    expect(usage.items).toEqual([]);
  });
});

describe('tool usage limits', () => {
  it('refuses when the organization hides individuals', async () => {
    privacy.hideIndividuals = true;

    for (let read of [
      agentTrackingToolService.getSkillUsage({ ...scope, range: {} }),
      agentTrackingToolService.getMcpServerUsage({ ...scope, range: {} })
    ]) {
      expect(await rejection(read)).toMatchObject({
        status: 403,
        code: 'agent_tracking_individuals_hidden'
      });
    }
    expect(callsTo('query:run')).toHaveLength(0);
  });

  it('refuses a range longer than the records are kept', async () => {
    let error = await rejection(
      agentTrackingToolService.getSkillUsage({
        ...scope,
        range: { from: new Date('2026-07-01T00:00:00Z'), to: now }
      })
    );

    expect(error).toMatchObject({
      status: 400,
      message:
        'Skill and MCP usage come from individual records, which are kept for 90 days. Choose a range of at most 90 days.'
    });
    expect(callsTo('query:run')).toHaveLength(0);
  });
});
