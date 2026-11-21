import { ServiceError, tooManyRequestsError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  breakdownQuery,
  periodTotalQuery,
  timelineQuery,
  unknownModelsQuery
} from '../src/lib/queries';
import { agentTrackingSpendService } from '../src/services/agentTrackingSpend';
import { callsTo, consumers, remoteMember, resetMocks, rpc, scope } from './_mocks';

let resolved = {
  preset: null,
  from: new Date('2026-11-16T00:00:00Z'),
  to: new Date('2026-11-18T00:00:00Z'),
  timeZone: 'UTC'
};

let figures = (cost: number | null, extra: Record<string, unknown> = {}) => ({
  'cost.usd': cost,
  'cost.list': cost,
  'cost.reported':
    cost === null ? [] : [{ unit: 'usd', basis: 'client_estimate', amount: cost }],
  requests: 4,
  tokens: { inputUncached: 1, cacheRead: 1, cacheWrite: 1, output: 1, reasoning: 0, total: 4 },
  ...extra
});

describe('spend query documents', () => {
  it('asks for the top 10 by cost with shares, an other row and requests without prices', () => {
    let byMember = breakdownQuery({ range: resolved, groupBy: 'member' });

    expect(byMember).toMatchObject({
      dimensions: ['user'],
      derived: [{ as: 'share', expr: { shareOfTotal: 'cost.usd' }, format: 'percent' }],
      orderBy: [{ by: 'cost.usd', direction: 'desc' }],
      limit: 10,
      other: true,
      totals: true
    });
    expect(breakdownQuery({ range: resolved, groupBy: 'model' }).dimensions).toEqual([
      'model'
    ]);
    expect(byMember.measures).toEqual(
      expect.arrayContaining([
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
        }
      ])
    );
    expect(timelineQuery(resolved)).toMatchObject({ dimensions: ['time.day'], totals: true });
    expect(periodTotalQuery(resolved)).not.toHaveProperty('dimensions');
  });
});

describe('spend filters', () => {
  it('filters by the service client family and by model, Unknown Model by a missing model', () => {
    expect(
      timelineQuery(resolved, { clientFamilies: ['claude_code'], modelIds: ['unknown'] })
    ).toMatchObject({
      where: {
        and: [
          { field: 'client.family', op: 'in', value: ['claude-code'] },
          { field: 'model', op: 'isNull' }
        ]
      }
    });
    expect(
      periodTotalQuery({ ...resolved }, { modelIds: ['claude-sonnet-4-5', 'unknown'] }).where
    ).toEqual({
      or: [
        { field: 'model', op: 'in', value: ['claude-sonnet-4-5'] },
        { field: 'model', op: 'isNull' }
      ]
    });
    expect(
      breakdownQuery({ range: resolved, groupBy: 'model', filters: { modelIds: ['x'] } }).where
    ).toEqual({ field: 'model', op: 'in', value: ['x'] });
    expect(timelineQuery(resolved, {})).not.toHaveProperty('where');
  });

  it('keeps the unknown model names to the client filter', () => {
    expect(
      unknownModelsQuery(resolved, { clientFamilies: ['cursor'], modelIds: ['unknown'] }).where
    ).toEqual({
      and: [
        { field: 'model', op: 'isNull' },
        { field: 'client.family', op: 'in', value: ['cursor'] }
      ]
    });
    expect(unknownModelsQuery(resolved).where).toEqual({ field: 'model', op: 'isNull' });
  });
});

describe('agentTrackingSpendService', () => {
  beforeEach(() => resetMocks());

  it('scopes the timeline to the service instance and presents every day', async () => {
    rpc.handlers['query:run'] = () => ({
      rows: [
        { 'time.day': '2026-11-16T00:00:00+01:00', ...figures(0) },
        { 'time.day': '2026-11-17T00:00:00+01:00', ...figures(1.25) }
      ],
      totals: figures(1.25),
      labels: {}
    });

    let timeline = await agentTrackingSpendService.getTimeline({
      ...scope,
      range: { from: resolved.from, to: resolved.to, timeZone: 'Europe/Berlin' }
    });

    let [call] = callsTo('query:run');
    expect(call!.input).toMatchObject({
      organizationId: 'org_1',
      scope: { instanceIds: ['inst_1'] },
      query: { dataset: 'usage', timeZone: 'Europe/Berlin' }
    });
    expect(call!.opts).toMatchObject({ retry: false, captureErrors: false });

    expect(timeline.items.map(item => item.date)).toEqual(['2026-11-16', '2026-11-17']);
    expect(timeline.items[0]!.cost.totalMicros).toBe(0);
    expect(timeline.total.cost).toMatchObject({
      totalMicros: 1250000,
      isEstimate: true,
      reportedByClientMicros: 1250000
    });
  });

  it('counts sessions and members and totals the period before, in one more query', async () => {
    rpc.handlers['query:run'] = ({ query }) =>
      query.dimensions
        ? {
            rows: [{ 'time.day': '2026-11-16T00:00:00Z', ...figures(1.25) }],
            totals: { ...figures(1.25), sessions_active: 7, members_active: 3 },
            labels: {},
            meta: { warnings: [{ code: 'distinct_capped', message: 'capped' }] }
          }
        : {
            rows: [],
            totals: figures(2, {
              'cost.reported': [{ unit: 'usd', basis: 'billed', amount: 0.5 }]
            }),
            labels: {},
            meta: { warnings: [{ code: 'retention_clipped', message: 'clipped' }] }
          };

    let timeline = await agentTrackingSpendService.getTimeline({
      ...scope,
      range: { from: resolved.from, to: resolved.to }
    });

    let calls = callsTo('query:run');
    expect(calls).toHaveLength(2);
    expect(calls.map(call => call.input.query.range)).toEqual([
      { from: '2026-11-16T00:00:00.000Z', to: '2026-11-18T00:00:00.000Z' },
      { from: '2026-11-14T00:00:00.000Z', to: '2026-11-16T00:00:00.000Z' }
    ]);
    expect(calls[1]!.input.scope).toEqual({ instanceIds: ['inst_1'] });

    expect(timeline.counts).toEqual({ sessions: 7, members: 3, capped: true });
    expect(timeline.previous.range).toEqual({
      preset: null,
      from: new Date('2026-11-14T00:00:00Z'),
      to: new Date('2026-11-16T00:00:00Z'),
      timeZone: 'UTC'
    });
    expect(timeline.previous.startsBeforeRetention).toBe(true);
    expect(timeline.previous.total.cost).toMatchObject({
      totalMicros: 2000000,
      billedMicros: 500000,
      estimatedMicros: 1500000
    });
  });

  it('counts sessions, members and tokens per day from the same query', async () => {
    rpc.handlers['query:run'] = ({ query }) =>
      query.dimensions
        ? {
            rows: [
              {
                'time.day': '2026-11-16T00:00:00Z',
                ...figures(1),
                sessions_active: 3,
                members_active: 2
              },
              {
                'time.day': '2026-11-17T00:00:00Z',
                ...figures(0),
                sessions_active: 0,
                members_active: 0
              }
            ],
            totals: { ...figures(1), sessions_active: 3, members_active: 2 },
            labels: {}
          }
        : { rows: [], totals: figures(0), labels: {} };

    let timeline = await agentTrackingSpendService.getTimeline({
      ...scope,
      range: { from: resolved.from, to: resolved.to }
    });

    expect(callsTo('query:run')).toHaveLength(2);
    expect(timeline.items.map(item => [item.date, item.counts, item.tokens.total])).toEqual([
      ['2026-11-16', { sessions: 3, members: 2 }, 4],
      ['2026-11-17', { sessions: 0, members: 0 }, 4]
    ]);
  });

  it('applies the filters to the range and the period before, and caches per filter', async () => {
    rpc.handlers['query:run'] = () => ({ rows: [], totals: figures(0), labels: {} });
    let read = (filters: Record<string, string[]>) =>
      agentTrackingSpendService.getTimeline({
        ...scope,
        range: { from: resolved.from, to: resolved.to },
        filters
      });

    await read({ clientFamilies: ['claude_code'], modelIds: ['b', 'a'] });
    await read({ modelIds: ['a', 'b', 'a'], clientFamilies: ['claude_code'] });
    await read({});

    let calls = callsTo('query:run');
    expect(calls).toHaveLength(4);
    for (let call of calls.slice(0, 2)) {
      expect(call.input.query.where).toEqual({
        and: [
          { field: 'client.family', op: 'in', value: ['claude-code'] },
          { field: 'model', op: 'in', value: ['a', 'b'] }
        ]
      });
    }
    expect(calls[2]!.input.query).not.toHaveProperty('where');
  });

  it('treats both spellings of a client family as one filter', async () => {
    rpc.handlers['query:run'] = () => ({ rows: [], totals: figures(0), labels: {} });
    let read = (clientFamilies: string[]) =>
      agentTrackingSpendService.getTimeline({
        ...scope,
        range: { from: resolved.from, to: resolved.to },
        filters: { clientFamilies }
      });

    await read(['claude-code']);
    await read(['claude_code', 'claude-code']);

    let calls = callsTo('query:run');
    expect(calls).toHaveLength(2);
    expect(calls[0]!.input.query.where).toEqual({
      field: 'client.family',
      op: 'in',
      value: ['claude-code']
    });
  });

  it('filters the breakdown and the names behind Unknown Model', async () => {
    rpc.handlers['query:run'] = ({ query }) =>
      query.dimensions[0].field == 'model.raw'
        ? { rows: [{ 'model.raw': 'claude-experimental-x', requests: 3 }] }
        : { rows: [{ model: null, ...figures(2), share: 1 }], totals: figures(2), labels: {} };

    await agentTrackingSpendService.getBreakdown({
      ...scope,
      groupBy: 'model',
      range: {},
      filters: { clientFamilies: ['claude_code'], modelIds: ['unknown'] }
    });

    let [breakdown, names] = callsTo('query:run').map(call => call.input.query);
    expect(breakdown.where).toEqual({
      and: [
        { field: 'client.family', op: 'in', value: ['claude-code'] },
        { field: 'model', op: 'isNull' }
      ]
    });
    expect(names.where).toEqual({
      and: [
        { field: 'model', op: 'isNull' },
        { field: 'client.family', op: 'in', value: ['claude-code'] }
      ]
    });
  });

  it('reads counts of zero and a complete previous period without warnings', async () => {
    rpc.handlers['query:run'] = () => ({ rows: [], totals: figures(0), labels: {} });

    let timeline = await agentTrackingSpendService.getTimeline({
      ...scope,
      range: { preset: 'last_month' }
    });

    expect(timeline.counts).toEqual({ sessions: 0, members: 0, capped: false });
    expect(timeline.previous.startsBeforeRetention).toBe(false);
    expect(timeline.previous.range.to).toEqual(timeline.range.from);
  });

  it('presents shares, ties in engine order, Unknown Member and other', async () => {
    rpc.handlers['query:run'] = () => ({
      rows: [
        { user: 'aten_ada', ...figures(5), share: 0.5 },
        { user: 'aten_bob', ...figures(2), share: 0.2 },
        { user: 'aten_cy', ...figures(2), share: 0.2 },
        { user: null, ...figures(0.5), share: 0.05 },
        { user: '$other', ...figures(0.5), share: 0.05 }
      ],
      totals: figures(10),
      labels: { user: { aten_bob: { name: 'Bob' }, aten_cy: { name: 'Cy' } } }
    });
    rpc.handlers['entity:list'] = () => ({
      items: [
        remoteMember(),
        remoteMember({
          id: 'aten_bob',
          source: null,
          ref: null,
          name: 'Bob',
          identifiers: [{ type: 'email', value: 'bob@example.com' }]
        })
      ],
      pagination: {}
    });
    consumers.findMany.mockImplementation(async () => [
      {
        id: 'con_ada',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        instanceConsumers: [{ id: 'icon_ada' }]
      }
    ]);

    let breakdown = await agentTrackingSpendService.getBreakdown({
      ...scope,
      groupBy: 'member',
      range: {}
    });

    expect(callsTo('entity:list')).toHaveLength(1);
    expect(callsTo('entity:list')[0]!.input).toMatchObject({
      kinds: ['user'],
      ids: ['aten_ada', 'aten_bob', 'aten_cy']
    });
    expect(consumers.findMany).toHaveBeenCalledTimes(1);

    expect(breakdown.items.map(item => [item.kind, item.key, item.share])).toEqual([
      ['member', 'aten_ada', 0.5],
      ['member', 'aten_bob', 0.2],
      ['member', 'aten_cy', 0.2],
      ['unknown', 'unknown', 0.05],
      ['other', 'other', 0.05]
    ]);
    expect(breakdown.items[0]!.member).toMatchObject({
      matched: true,
      name: 'Ada Lovelace',
      consumer: { id: 'icon_ada', email: 'ada@example.com' }
    });
    expect(breakdown.items[1]!.member).toMatchObject({
      matched: false,
      email: 'bob@example.com'
    });
    expect(breakdown.items[2]!.member).toMatchObject({
      id: 'aten_cy',
      name: 'Cy',
      email: null
    });
    expect(breakdown.items[3]!.member).toBeNull();
  });

  it('does not show unpriced usage as an exact zero', async () => {
    rpc.handlers['query:run'] = () => ({
      rows: [
        {
          'time.day': '2026-11-16T00:00:00Z',
          ...figures(0),
          requests_without_cost: 4,
          requests_without_list_price: 4
        },
        {
          'time.day': '2026-11-17T00:00:00Z',
          ...figures(1, { requests: 6 }),
          requests_without_cost: 2,
          requests_without_list_price: 0
        },
        {
          'time.day': '2026-11-18T00:00:00Z',
          ...figures(0, { requests: 0 }),
          requests_without_cost: 0,
          requests_without_list_price: 0
        }
      ],
      totals: {
        ...figures(1, { requests: 10 }),
        requests_without_cost: 6,
        requests_without_list_price: 4
      },
      labels: {}
    });

    let timeline = await agentTrackingSpendService.getTimeline({ ...scope, range: {} });
    let [unpriced, partly, empty] = timeline.items;

    expect(unpriced!.cost).toMatchObject({
      totalMicros: null,
      estimatedMicros: null,
      isEstimate: false,
      listPriceMicros: null,
      requestsWithoutCost: 4
    });
    expect(partly!.cost).toMatchObject({
      totalMicros: 1000000,
      listPriceMicros: 1000000,
      requestsWithoutCost: 2
    });
    expect(empty!.cost).toMatchObject({ totalMicros: 0, requestsWithoutCost: 0 });
    expect(timeline.total.cost).toMatchObject({
      totalMicros: 1000000,
      requestsWithoutCost: 6
    });
  });

  it('shows 0 for every amount without requests, whatever the engine fills in', async () => {
    let idle = {
      'cost.usd': null,
      'cost.list': null,
      'cost.reported': null,
      requests: 0,
      requests_without_cost: 0,
      requests_without_list_price: 0,
      tokens: null
    };
    rpc.handlers['query:run'] = () => ({
      rows: [{ 'time.day': '2026-11-16T00:00:00Z', ...idle }],
      totals: idle,
      labels: {}
    });

    let timeline = await agentTrackingSpendService.getTimeline({ ...scope, range: {} });

    for (let figures of [timeline.items[0]!, timeline.total]) {
      expect(figures.cost).toMatchObject({
        totalMicros: 0,
        estimatedMicros: 0,
        listPriceMicros: 0,
        reportedByClientMicros: null,
        requestsWithoutCost: 0,
        requestsWithoutListPrice: 0
      });
    }
  });

  it('says how many requests the list price leaves out', async () => {
    rpc.handlers['query:run'] = () => ({
      rows: [],
      totals: {
        ...figures(3.74, { requests: 40, 'cost.list': 0.27 }),
        requests_without_cost: 0,
        requests_without_list_price: 37
      },
      labels: {}
    });

    let timeline = await agentTrackingSpendService.getTimeline({ ...scope, range: {} });

    expect(timeline.total.cost).toMatchObject({
      totalMicros: 3740000,
      listPriceMicros: 270000,
      requestsWithoutCost: 0,
      requestsWithoutListPrice: 37
    });
  });

  it('leaves out breakdown rows without requests, tokens or cost', async () => {
    rpc.handlers['query:run'] = () => ({
      rows: [
        { model: 'claude-sonnet-4-5', ...figures(1), share: 1 },
        {
          model: null,
          ...figures(0, { requests: 0, tokens: { total: 0 }, 'cost.reported': [] }),
          share: 0
        }
      ],
      totals: figures(1),
      labels: { model: { 'claude-sonnet-4-5': { name: 'Claude Sonnet 4.5' } } }
    });

    let breakdown = await agentTrackingSpendService.getBreakdown({
      ...scope,
      groupBy: 'model',
      range: {}
    });

    expect(breakdown.items.map(item => item.key)).toEqual(['claude-sonnet-4-5']);
    expect(callsTo('query:run')).toHaveLength(1);
  });

  it('names the models behind Unknown Model with one more query', async () => {
    rpc.handlers['query:run'] = ({ query }) =>
      query.dimensions[0].field == 'model.raw'
        ? {
            rows: [
              { 'model.raw': 'claude-experimental-x', requests: 3 },
              { 'model.raw': 'claude-mythos-5-2', requests: 1 },
              { 'model.raw': null, requests: 0 }
            ]
          }
        : {
            rows: [
              { model: 'claude-sonnet-4-5', ...figures(2), share: 0.5 },
              { model: null, ...figures(2), share: 0.5 }
            ],
            totals: figures(4),
            labels: { model: { 'claude-sonnet-4-5': { name: 'Claude Sonnet 4.5' } } }
          };

    let breakdown = await agentTrackingSpendService.getBreakdown({
      ...scope,
      groupBy: 'model',
      range: {}
    });

    expect(callsTo('query:run')[1]!.input.query).toMatchObject({
      dataset: 'usage',
      where: { field: 'model', op: 'isNull' },
      dimensions: [{ field: 'model.raw', missing: 'exclude' }],
      limit: 10
    });
    expect(breakdown.items.map(item => [item.kind, item.unknownModelNames])).toEqual([
      ['model', []],
      ['unknown', ['claude-experimental-x', 'claude-mythos-5-2']]
    ]);
  });

  it('still shows Unknown Model when its names cannot be read', async () => {
    rpc.handlers['query:run'] = ({ query }) => {
      if (query.dimensions[0].field == 'model.raw') {
        throw new ServiceError(tooManyRequestsError({ message: 'limit' }));
      }

      return {
        rows: [{ model: null, ...figures(2), share: 1 }],
        totals: figures(2),
        labels: {}
      };
    };

    let breakdown = await agentTrackingSpendService.getBreakdown({
      ...scope,
      groupBy: 'model',
      range: {}
    });

    expect(breakdown.items).toEqual([
      expect.objectContaining({ kind: 'unknown', unknownModelNames: [] })
    ]);
  });

  it('keeps a null share when the total is zero', async () => {
    rpc.handlers['query:run'] = () => ({
      rows: [{ model: 'claude-sonnet-4-5', ...figures(0), share: null }],
      totals: figures(0),
      labels: { model: { 'claude-sonnet-4-5': { name: 'Claude Sonnet 4.5' } } }
    });

    let breakdown = await agentTrackingSpendService.getBreakdown({
      ...scope,
      groupBy: 'model',
      range: { preset: 'today' }
    });

    expect(breakdown.items).toEqual([
      expect.objectContaining({
        kind: 'model',
        key: 'claude-sonnet-4-5',
        model: { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
        share: null
      })
    ]);
    expect(callsTo('entity:list')).toHaveLength(0);
  });
});
