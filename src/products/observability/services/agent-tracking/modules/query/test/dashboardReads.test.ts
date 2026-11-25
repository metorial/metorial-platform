import { describe, expect, it } from 'vitest';
import { datasets } from '../src/catalog';
import { finalize } from '../src/lib/finalize';
import { planQuery } from '../src/lib/plan';
import { aggregatePipeline, bind } from './compileHarness';

describe('last activity per member', () => {
  it('groups sessions by user with their latest activity', () => {
    let bound = bind({
      dataset: 'sessions',
      dimensions: [{ field: 'user', missing: 'exclude' }],
      measures: ['sessions', 'last_activity'],
      orderBy: [{ by: 'last_activity', direction: 'desc' }],
      limit: 1000
    });

    let plan = planQuery(bound);
    let pipeline = aggregatePipeline(bound);

    expect(JSON.stringify(pipeline)).toContain('"$max"');
    expect(JSON.stringify(pipeline)).toContain('lastActivityAt');
    expect(datasets.sessions.metrics.last_activity).toMatchObject({ fn: 'max', type: 'date' });

    let earlier = new Date('2026-11-14T10:47:00.000Z');
    let later = new Date('2026-11-14T10:51:00.000Z');
    let result = finalize({
      query: bound,
      plan,
      main: {
        groups: [
          { _id: { k0: 'aten_earlier' }, a0: 1, a1: earlier },
          { _id: { k0: 'aten_later' }, a0: 1, a1: later }
        ],
        reported: new Map()
      },
      mapped: null
    });

    expect(result.rows.map(row => [row.user, row.last_activity])).toEqual([
      ['aten_later', '2026-11-14T10:51:00+00:00'],
      ['aten_earlier', '2026-11-14T10:47:00+00:00']
    ]);
    expect(result.columns.find(column => column.name == 'last_activity')).toMatchObject({
      type: 'date'
    });
  });

  it('keeps date measures timestamps through having, compare and totals', () => {
    let bound = bind({
      dataset: 'sessions',
      timeZone: 'Europe/Berlin',
      dimensions: [{ field: 'user', missing: 'exclude' }],
      measures: ['sessions', 'last_activity'],
      having: { field: 'last_activity', op: 'gte', value: '2026-11-14T10:50:00Z' },
      compare: { previous: 'period' },
      totals: true,
      limit: 10
    });
    let plan = planQuery(bound);

    let group = (user: string, sessions: number, at: string) => ({
      _id: { k0: user },
      a0: sessions,
      a1: new Date(at)
    });

    let result = finalize({
      query: bound,
      plan,
      main: {
        groups: [
          group('aten_earlier', 1, '2026-11-14T10:47:00Z'),
          group('aten_later', 1, '2026-11-14T10:51:00Z')
        ],
        reported: new Map()
      },
      compare: {
        groups: [group('aten_later', 1, '2026-11-14T10:41:00Z')],
        reported: new Map()
      },
      totals: {
        groups: [{ _id: {}, a0: 2, a1: new Date('2026-11-14T10:51:00Z') }],
        reported: new Map()
      },
      mapped: null
    });

    expect(result.rows).toEqual([
      expect.objectContaining({
        user: 'aten_later',
        last_activity: '2026-11-14T11:51:00+01:00',
        'last_activity@previous': '2026-11-14T11:41:00+01:00',
        'last_activity@delta': 10 * 60 * 1000
      })
    ]);
    expect(result.rows[0]).not.toHaveProperty('last_activity@change');
    expect(result.totals).toMatchObject({ last_activity: '2026-11-14T11:51:00+01:00' });
    expect(
      result.columns
        .filter(column => column.name.startsWith('last_activity'))
        .map(column => [column.name, column.type])
    ).toEqual([
      ['last_activity', 'date'],
      ['last_activity@previous', 'date'],
      ['last_activity@delta', 'duration']
    ]);
  });

  it('accepts a timestamp in having only for a date measure', () => {
    expect(() =>
      bind({
        dataset: 'sessions',
        dimensions: ['user'],
        measures: ['sessions'],
        having: { field: 'sessions', op: 'gte', value: '2026-11-14T10:50:00Z' }
      })
    ).toThrow();
    expect(() =>
      bind({
        dataset: 'sessions',
        dimensions: ['user'],
        measures: ['sessions', 'last_activity'],
        compare: { previous: 'period' },
        having: { field: 'last_activity@change', op: 'gt', value: 0 }
      })
    ).toThrow();
  });
});

describe('tool details evidence', () => {
  it('counts tool calls that arrived as logs with a tool input or an MCP server', () => {
    let bound = bind({
      dataset: 'tool_calls',
      where: {
        and: [
          { field: 'source.channel', op: 'eq', value: 'otlp.logs' },
          {
            or: [
              { field: 'content.roles', op: 'eq', value: 'tool_input' },
              { field: 'mcp.server', op: 'notNull' }
            ]
          }
        ]
      },
      measures: [{ fn: 'count', as: 'tool_calls_with_details' }],
      labels: false
    });

    let pipeline = JSON.stringify(aggregatePipeline(bound));

    expect(pipeline).toContain('"source.channel"');
    expect(pipeline).toContain('"content.role"');
    expect(pipeline).toContain('"tool_input"');
    expect(datasets.tool_calls.fields['content.roles']).toMatchObject({ array: true });
  });

  it('limits setup evidence to one client family on sessions and tool calls', () => {
    let claudeCode = { field: 'client.family', op: 'eq', value: 'claude-code' };

    let sessions = bind({
      dataset: 'sessions',
      where: claudeCode,
      measures: [
        {
          fn: 'count',
          where: { field: 'coverage.hasUsage', op: 'eq', value: true },
          as: 'sessions_with_usage'
        },
        {
          fn: 'count',
          where: { field: 'coverage.hasRepo', op: 'eq', value: true },
          as: 'sessions_with_repo'
        }
      ],
      labels: false
    });
    let toolCalls = bind({
      dataset: 'tool_calls',
      where: {
        and: [claudeCode, { field: 'source.channel', op: 'eq', value: 'otlp.logs' }]
      },
      measures: [{ fn: 'count', as: 'tool_calls_with_details' }],
      labels: false
    });

    expect(sessions.measures.map(measure => measure.name)).toEqual([
      'sessions_with_usage',
      'sessions_with_repo'
    ]);
    expect(toolCalls.where).toBeDefined();
  });

  it('rejects a content role that does not exist', () => {
    expect(() =>
      bind({
        dataset: 'tool_calls',
        where: { field: 'content.roles', op: 'eq', value: 'tool_parameters' },
        measures: ['tool_calls']
      })
    ).toThrow();
  });
});

describe('dashboard spend queries', () => {
  let modes = ['included', 'overage', 'api', 'unknown'].map(mode => ({
    fn: 'sum',
    field: 'cost.usd',
    where:
      mode == 'unknown'
        ? {
            or: [
              { field: 'billing.mode', op: 'eq', value: 'unknown' },
              { field: 'billing.mode', op: 'isNull' }
            ]
          }
        : { field: 'billing.mode', op: 'eq', value: mode },
    as: `cost_usd_${mode}`
  }));

  let measures = [
    'cost.usd',
    'cost.list',
    'cost.reported',
    ...modes,
    'requests',
    {
      fn: 'sum',
      field: 'requests',
      where: { field: 'cost.usd', op: 'isNull' },
      as: 'requests_without_cost'
    },
    {
      fn: 'sum',
      field: 'requests',
      where: { field: 'cost.list', op: 'isNull' },
      as: 'requests_without_list_price'
    },
    'tokens'
  ];

  it('binds the daily series with zero fill and totals', () => {
    let bound = bind({
      dataset: 'usage',
      timeZone: 'Europe/Berlin',
      dimensions: ['time.day'],
      measures,
      fill: { time: 'zero' },
      totals: true,
      labels: false
    });

    expect(
      bound.measures.filter(measure => !measure.hidden).map(measure => measure.name)
    ).toEqual(
      expect.arrayContaining([
        'requests_without_cost',
        'cost_usd_included',
        'cost_usd_unknown'
      ])
    );
  });

  it('binds the breakdown with shares and an other row', () => {
    for (let dimension of ['user', 'model']) {
      let bound = bind({
        dataset: 'usage',
        dimensions: [dimension],
        measures,
        derived: [{ as: 'share', expr: { shareOfTotal: 'cost.usd' }, format: 'percent' }],
        orderBy: [{ by: 'cost.usd', direction: 'desc' }],
        limit: 10,
        other: true,
        totals: true
      });

      expect(bound).toMatchObject({ limit: 10, other: true, totals: true });
    }
  });
});

describe('tools tab queries', () => {
  let mcp = { field: 'tool.kind', op: 'eq', value: 'mcp' };

  it('reads skill activations from extension events, named ones apart', () => {
    let bound = bind({
      dataset: 'skill_activations',
      dimensions: [{ field: 'skill.name', missing: 'exclude' }],
      measures: ['skill_activations.named', 'users.active', 'last_used'],
      having: { field: 'skill_activations.named', op: 'gt', value: 0 },
      orderBy: [{ by: 'skill_activations.named', direction: 'desc' }],
      limit: 500,
      labels: false
    });
    let pipeline = JSON.stringify(aggregatePipeline(bound));

    expect(datasets.skill_activations).toMatchObject({
      collection: 'events',
      baseMatch: {
        type: 'extension.event',
        'data.kind': 'skill',
        'data.action': 'activated',
        'source.role': 'primary'
      },
      maxRangeDays: 90
    });
    expect(pipeline).toContain('"extension.event"');
    expect(pipeline).toContain('"$data.name"');
    expect(pipeline).toContain('"$max"');

    let named = JSON.stringify(bound.measures.find(m => m.name == 'skill_activations.named'));
    expect(named).toContain('"custom_skill"');
    expect(named).toContain('"claude-code"');
  });

  it('counts all and named activations in the summary', () => {
    let bound = bind({
      dataset: 'skill_activations',
      measures: ['skill_activations', 'skill_activations.named', 'users.active'],
      labels: false
    });

    expect(bound.measures.map(measure => measure.name)).toEqual([
      'skill_activations',
      'skill_activations.named',
      'users.active'
    ]);
  });

  it('groups MCP calls by server and tool with failures, people and last use', () => {
    let bound = bind({
      dataset: 'tool_calls',
      where: mcp,
      dimensions: [
        { field: 'mcp.server', missing: 'exclude' },
        { field: 'mcp.tool', missing: 'exclude' }
      ],
      measures: [
        'tool_calls',
        'tool_calls.failed',
        'tool_calls.error_rate',
        'users.active',
        'last_used'
      ],
      orderBy: [{ by: 'tool_calls', direction: 'desc' }],
      limit: 2000,
      labels: false
    });
    let pipeline = JSON.stringify(aggregatePipeline(bound));

    expect(pipeline).toContain('"$data.tool.mcp.server"');
    expect(pipeline).toContain('"$data.tool.mcp.tool"');
    expect(datasets.tool_calls.metrics.last_used).toMatchObject({
      fn: 'max',
      field: 'occurredAt',
      type: 'date'
    });
  });

  it('counts MCP calls with the redacted calls older Claude Code records keep', () => {
    let bound = bind({
      dataset: 'tool_calls',
      measures: [
        'mcp_calls',
        'mcp_calls.failed',
        'mcp_calls.error_rate',
        'mcp_calls.named',
        'mcp_calls.users',
        'mcp_calls.last_used'
      ],
      labels: false
    });
    let calls = JSON.stringify(bound.measures.find(m => m.name == 'mcp_calls'));

    expect(bound.measures.map(measure => measure.name)).toEqual([
      'mcp_calls',
      'mcp_calls.failed',
      'mcp_calls.error_rate',
      'mcp_calls.named',
      'mcp_calls.users',
      'mcp_calls.last_used'
    ]);
    expect(calls).toContain('"mcp_tool"');
    expect(calls).toContain('"mcp_other"');
    expect(calls).not.toContain('"custom"');

    let named = JSON.stringify(bound.measures.find(m => m.name == 'mcp_calls.named'));

    expect(named).toContain('"op":"notIn","value":["custom"]');
  });
});
