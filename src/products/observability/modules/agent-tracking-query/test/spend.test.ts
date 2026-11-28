import { ServiceError, tooManyRequestsError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  breakdownQuery,
  periodTotalQuery,
  timelineQuery,
  unknownModelsQuery
} from '../src/lib/queries';
import { spendFiguresOf } from '../src/lib/spend';
import { agentTrackingSpendService } from '../src/services/agentTrackingSpend';
import {
  callsTo,
  consumers,
  links,
  remoteMember,
  remoteRepository,
  resetMocks,
  rpc,
  scope
} from './_mocks';

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
  it('asks for the top 10 by cost, an other row, totals and usage without prices', () => {
    let byMember = breakdownQuery({ range: resolved, groupBy: 'member' });

    expect(byMember).toMatchObject({
      dimensions: ['user'],
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
        },
        {
          fn: 'sum',
          field: 'tokens.total',
          where: { field: 'cost.usd', op: 'isNull' },
          as: 'tokens_without_cost'
        },
        {
          fn: 'sum',
          field: 'tokens.total',
          where: { field: 'cost.list', op: 'isNull' },
          as: 'tokens_without_list_price'
        }
      ])
    );
    expect(byMember).not.toHaveProperty('derived');
    expect(timelineQuery(resolved)).toMatchObject({ dimensions: ['time.day'], totals: true });
    expect(periodTotalQuery(resolved)).not.toHaveProperty('dimensions');
  });
});

describe('spend breakdowns by repository, branch and ticket', () => {
  beforeEach(() => resetMocks());

  it('groups usage by its repository, branch and ticket fields', () => {
    expect(
      (['repository', 'branch', 'ticket'] as const).map(
        groupBy => breakdownQuery({ range: resolved, groupBy }).dimensions
      )
    ).toEqual([['repo'], ['branch'], ['ticket']]);
  });

  it('names repositories in one lookup and keeps usage without one as unknown', async () => {
    rpc.handlers['query:run'] = () => ({
      rows: [
        { repo: 'aten_repo', ...figures(5), share: 0.8 },
        { repo: null, ...figures(1), share: 0.2 },
        { repo: '$other', ...figures(1), share: 0.2 }
      ],
      totals: figures(6),
      labels: { repo: { aten_repo: { name: 'acme/api' } } }
    });
    rpc.handlers['entity:list'] = () => ({ items: [remoteRepository()], pagination: {} });

    let breakdown = await agentTrackingSpendService.getBreakdown({
      ...scope,
      groupBy: 'repository',
      range: {}
    });

    expect(callsTo('query:run')[0]!.input.query.dimensions).toEqual(['repo']);
    expect(callsTo('entity:list')).toHaveLength(1);
    expect(callsTo('entity:list')[0]!.input).toMatchObject({
      kinds: ['repo'],
      ids: ['aten_repo']
    });
    expect(breakdown.groupBy).toBe('repository');
    expect(breakdown.items.map(item => [item.kind, item.key, item.repository?.name])).toEqual([
      ['repository', 'aten_repo', 'api'],
      ['unknown', 'unknown', undefined],
      ['other', 'other', undefined]
    ]);
    expect(breakdown.items[0]!.repository).toEqual({
      id: 'aten_repo',
      provider: 'github.com',
      host: 'github.com',
      owner: 'acme',
      name: 'api',
      url: 'https://github.com/acme/api'
    });
  });

  it('links ticket rows with the template of the organization, cached per template', async () => {
    rpc.handlers['query:run'] = () => ({
      rows: [{ ticket: 'A&B-3', ...figures(5), share: 1 }],
      totals: figures(5),
      labels: {}
    });
    let read = () =>
      agentTrackingSpendService.getBreakdown({ ...scope, groupBy: 'ticket', range: {} });

    expect((await read()).items[0]!.ticket).toEqual({ key: 'A&B-3', url: null });

    links.ticketUrlTemplate = 'https://linear.app/acme/issue/{key}';
    expect((await read()).items[0]!.ticket).toEqual({
      key: 'A&B-3',
      url: 'https://linear.app/acme/issue/A%26B-3'
    });
    expect(callsTo('query:run')).toHaveLength(2);
  });

  it('shares each repository of a session in its full cost of the total spend', async () => {
    rpc.handlers['query:run'] = () => ({
      rows: [
        { repo: 'aten_repo', ...figures(10), share: 0.5 },
        { repo: 'aten_web', ...figures(10), share: 0.5 }
      ],
      totals: figures(10),
      labels: {}
    });
    rpc.handlers['entity:list'] = () => ({ items: [], pagination: {} });

    let breakdown = await agentTrackingSpendService.getBreakdown({
      ...scope,
      groupBy: 'repository',
      range: {}
    });

    expect(breakdown.total.cost.totalMicros).toBe(10_000_000);
    expect(breakdown.items.map(item => [item.key, item.share])).toEqual([
      ['aten_repo', 1],
      ['aten_web', 1]
    ]);
  });

  it('has no share when the total spend is zero, and shares every group of the total', async () => {
    rpc.handlers['query:run'] = ({ query }) => ({
      rows:
        query.dimensions[0] == 'model'
          ? [{ model: 'claude-sonnet-4-5', ...figures(4), share: 0.25 }]
          : [{ branch: 'main', ...figures(0), share: 0.3 }],
      totals: query.dimensions[0] == 'model' ? figures(16) : figures(0),
      labels: {}
    });

    let branches = await agentTrackingSpendService.getBreakdown({
      ...scope,
      groupBy: 'branch',
      range: {}
    });
    let models = await agentTrackingSpendService.getBreakdown({
      ...scope,
      groupBy: 'model',
      range: {}
    });

    expect(branches.items.map(item => item.share)).toEqual([null]);
    expect(models.items.map(item => item.share)).toEqual([0.25]);
  });

  it('keys branches and tickets by their value, a session counting in each of its tickets', async () => {
    rpc.handlers['query:run'] = ({ query }) => ({
      rows:
        query.dimensions[0] == 'ticket'
          ? [
              { ticket: 'ENG-12', ...figures(5), share: 1 },
              { ticket: 'ENG-13', ...figures(5), share: 1 }
            ]
          : [{ branch: 'main', ...figures(5), share: 1 }],
      totals: figures(5),
      labels: {}
    });

    let tickets = await agentTrackingSpendService.getBreakdown({
      ...scope,
      groupBy: 'ticket',
      range: {}
    });
    let branches = await agentTrackingSpendService.getBreakdown({
      ...scope,
      groupBy: 'branch',
      range: {}
    });

    expect(tickets.items.map(item => item.ticket)).toEqual([
      { key: 'ENG-12', url: null },
      { key: 'ENG-13', url: null }
    ]);
    expect(branches.items[0]!.ticket).toBeNull();
    expect(tickets.items.map(item => [item.kind, item.key, item.share])).toEqual([
      ['ticket', 'ENG-12', 1],
      ['ticket', 'ENG-13', 1]
    ]);
    expect(branches.items.map(item => [item.kind, item.key])).toEqual([['branch', 'main']]);
    expect(callsTo('entity:list')).toHaveLength(0);
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
    expect(timeline.items[0]!.cost!.totalMicros).toBe(0);
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
    expect(timeline.items.map(item => [item.date, item.counts, item.tokens!.total])).toEqual([
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

  it('filters the breakdown by member, with unknown meaning no member', async () => {
    rpc.handlers['query:run'] = () => ({ rows: [], totals: null, meta: {} });

    await agentTrackingSpendService.getBreakdown({
      ...scope,
      groupBy: 'model',
      range: { preset: 'last_7_days' },
      filters: { memberIds: ['unknown', 'aten_bob', 'aten_ada'] }
    });

    expect(callsTo('query:run')[0]!.input.query.where).toEqual({
      or: [
        { field: 'user', op: 'in', value: ['aten_ada', 'aten_bob'] },
        { field: 'user', op: 'isNull' }
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
          requests_without_list_price: 4,
          tokens_without_cost: 4,
          tokens_without_list_price: 4
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

  describe('turn-level usage, which has tokens but no requests', () => {
    let turns = (cost: number | null, tokensWithoutCost: number) => ({
      ...figures(cost, { requests: 0 }),
      requests_without_cost: 0,
      requests_without_list_price: 0,
      tokens_without_cost: tokensWithoutCost,
      tokens_without_list_price: tokensWithoutCost
    });

    it('is unpriced, not $0, when its model has no price', () => {
      expect(spendFiguresOf(turns(0, 4)).cost).toMatchObject({
        totalMicros: null,
        estimatedMicros: null,
        listPriceMicros: null,
        requestsWithoutCost: 0
      });
    });

    it('keeps the cost of priced turns', () => {
      expect(spendFiguresOf(turns(0.5, 0)).cost).toMatchObject({
        totalMicros: 500000,
        listPriceMicros: 500000
      });
    });

    it('is unpriced only when neither its requests nor its turns had a cost', () => {
      let unpricedRequests = {
        ...figures(0.5, { requests: 2 }),
        tokens: { inputUncached: 8, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0 },
        requests_without_cost: 2,
        requests_without_list_price: 2,
        tokens_without_cost: 4,
        tokens_without_list_price: 4
      };
      let unpricedTurns = { ...unpricedRequests, requests_without_cost: 0 };
      let neither = { ...unpricedRequests, tokens_without_cost: 8 };

      expect(spendFiguresOf(unpricedRequests).cost.totalMicros).toBe(500000);
      expect(spendFiguresOf(unpricedTurns).cost.totalMicros).toBe(500000);
      expect(spendFiguresOf(neither).cost.totalMicros).toBeNull();
    });

    it('shows an unpriced Cursor breakdown row as unpriced', async () => {
      rpc.handlers['query:run'] = () => ({
        rows: [{ model: 'cursor/composer-2.5', ...turns(0, 4) }],
        totals: turns(0, 4),
        labels: {}
      });

      let breakdown = await agentTrackingSpendService.getBreakdown({
        ...scope,
        groupBy: 'model',
        range: {}
      });

      expect(breakdown.total.cost.totalMicros).toBeNull();
      expect(breakdown.items.map(item => [item.key, item.cost.totalMicros])).toEqual([
        ['cursor/composer-2.5', null]
      ]);
    });
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
