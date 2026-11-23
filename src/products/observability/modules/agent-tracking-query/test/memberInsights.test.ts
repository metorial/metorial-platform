import { notFoundError, ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it } from 'vitest';

import { agentTrackingMemberInsightService } from '../src/services/agentTrackingMemberInsight';
import { buildMemberInsights } from '../src/lib/memberInsights';
import { maxConsumerLookups } from '../src/lib/members';
import { maxInsightMembers } from '../src/lib/queries';
import { resolveRange } from '../src/lib/range';
import type { MemberInsightsGroup } from '../src/lib/types';
import {
  callsTo,
  instanceConsumers,
  privacy,
  rejection,
  remoteMember,
  resetMocks,
  rpc,
  scope
} from './_mocks';

let dollar = 1_000_000;

let dayMs = 24 * 60 * 60 * 1000;

type Rows = Record<string, unknown>[];

type Answers = {
  usage?: Rows;
  usageTotals?: Record<string, unknown>;
  lastActivity?: Rows;
  requests?: Rows;
  requestTotals?: Record<string, unknown>;
  outdated?: Rows;
  truncated?: 'usage' | 'sessions' | 'requests' | 'outdated';
  usageWarnings?: { code: string }[];
};

let usageRow = (user: string | null, cost: number, extra: Record<string, unknown> = {}) => ({
  user,
  'cost.usd': cost,
  'cost.list': cost * 2,
  'cost.reported': [],
  requests: 10,
  requests_without_cost: 0,
  requests_without_list_price: 0,
  sessions_active: 2,
  members_active: user ? 1 : 0,
  cost_unattributed: user ? 0 : cost,
  ...extra
});

let defaultUsage = () => [
  usageRow('aten_ada', 3, {
    models_cost: 1.5,
    models_requests: 4,
    cost_outdated: 1,
    'cache.hit_rate': 0.8
  }),
  usageRow('aten_bob', 1, {
    models_cost: 0,
    models_requests: 1,
    cost_outdated: 0,
    'cache.hit_rate': 0.2
  }),
  usageRow(null, 1)
];

let kindOf = (query: any) =>
  query.dataset == 'sessions'
    ? 'sessions'
    : query.dataset == 'requests'
      ? 'requests'
      : query.dimensions.length > 1
        ? 'outdated'
        : 'usage';

let answer = (answers: Answers = {}) => {
  rpc.handlers['entity:list'] = ({ ids }) => ({
    items: ids.map((id: string) => remoteMember({ id, source: null, ref: null, name: id })),
    pagination: {}
  });
  rpc.handlers['knowledge:models:get'] = ({ modelId }) => ({
    name: modelId == 'claude-3-opus' ? 'Claude 3 Opus' : null
  });
  rpc.handlers['query:run'] = ({ query }: any) => {
    let kind = kindOf(query);
    let meta = { truncated: answers.truncated == kind, warnings: [] as { code: string }[] };

    if (kind == 'usage') {
      return {
        rows: answers.usage ?? defaultUsage(),
        totals: answers.usageTotals ?? {
          ...usageRow(null, 5, {
            models_cost: 1.5,
            models_requests: 5,
            cost_outdated: 1,
            'cache.hit_rate': 0.6
          }),
          requests: 30,
          sessions_active: 6,
          members_active: 2,
          cost_unattributed: 1
        },
        meta: { ...meta, warnings: answers.usageWarnings ?? [] }
      };
    }
    if (kind == 'sessions') {
      return {
        rows: answers.lastActivity ?? [
          { user: 'aten_ada', last_activity: '2026-11-18T10:00:00.000Z' }
        ],
        meta
      };
    }
    if (kind == 'requests') {
      return {
        rows: answers.requests ?? [
          {
            user: 'aten_ada',
            'billing.seat': 'premium',
            'billing.plan': 'max',
            requests: 8,
            requests_high_effort: 4,
            requests_max_effort: 2,
            requests_with_effort: 8,
            requests_fast: 0,
            requests_with_speed: 0
          },
          {
            user: 'aten_ada',
            'billing.seat': null,
            'billing.plan': 'team',
            requests: 2,
            requests_high_effort: 0,
            requests_max_effort: 0,
            requests_with_effort: 2,
            requests_fast: 0,
            requests_with_speed: 0
          },
          {
            user: 'aten_bob',
            'billing.seat': null,
            'billing.plan': null,
            requests: 5,
            requests_high_effort: 1,
            requests_max_effort: 0,
            requests_with_effort: 5,
            requests_fast: 0,
            requests_with_speed: 0
          },
          { user: null, requests: 3 }
        ],
        totals: answers.requestTotals ?? {
          requests: 18,
          requests_high_effort: 5,
          requests_max_effort: 2,
          requests_with_effort: 15,
          requests_fast: 0,
          requests_with_speed: 0
        },
        meta
      };
    }

    return {
      rows: answers.outdated ?? [
        {
          user: 'aten_ada',
          model: 'claude-3-opus',
          'model.status': 'retired',
          'model.isLatest': 'false',
          'cost.usd': 1
        },
        {
          user: 'aten_ada',
          model: 'claude-sonnet-4',
          'model.status': 'active',
          'model.isLatest': 'false',
          'cost.usd': 0.5
        }
      ],
      meta
    };
  };
};

let read = (
  d: Partial<Parameters<typeof agentTrackingMemberInsightService.listMemberInsights>[0]> = {}
) => agentTrackingMemberInsightService.listMemberInsights({ ...scope, page: {}, ...d });

let queriesOf = (kind: string) =>
  callsTo('query:run')
    .map(call => call.input.query)
    .filter(query => kindOf(query) == kind);

let ids = (result: Awaited<ReturnType<typeof read>>) =>
  result.list.items.map(item => [item.id, item.rank]);

let all: MemberInsightsGroup[] = ['models', 'practices', 'seat'];

describe('member insights figures', () => {
  beforeEach(() => {
    resetMocks();
    answer();
  });

  it('merges every result set by member and leaves usage without a member out', async () => {
    let result = await read({ include: all, modelIds: ['claude-sonnet-4-5'] });
    let [ada, bob] = result.list.items;

    expect(result.list.items.map(item => item.id)).toEqual(['aten_ada', 'aten_bob']);
    expect(ada).toMatchObject({
      id: 'aten_ada',
      rank: 1,
      member: { id: 'aten_ada', name: 'aten_ada' },
      cost: { totalMicros: 3 * dollar, listPriceMicros: 6 * dollar },
      share: 0.6,
      sessions: 2,
      requests: 10,
      lastActivityAt: new Date('2026-11-18T10:00:00.000Z'),
      models: { costMicros: 1.5 * dollar, requests: 4, costShare: 0.5, requestShare: 0.4 },
      practices: {
        requestsMeasured: 10,
        highEffortRequests: 4,
        maxEffortRequests: 2,
        highEffortShare: 0.6,
        fastRequests: 0,
        fastShare: null,
        outdatedCostMicros: dollar,
        cacheHitRate: 0.8
      },
      seat: { seat: 'premium', plan: 'max', listPriceMicros: 6 * dollar }
    });
    expect(ada!.practices!.outdatedShare).toBeCloseTo(1 / 3, 9);
    expect(ada!.practices!.outdatedModels).toEqual([
      {
        model: { id: 'claude-3-opus', name: 'Claude 3 Opus' },
        status: 'retired',
        isLatest: false,
        costMicros: dollar
      },
      {
        model: { id: 'claude-sonnet-4', name: null },
        status: 'active',
        isLatest: false,
        costMicros: dollar / 2
      }
    ]);
    expect(bob).toMatchObject({
      lastActivityAt: null,
      models: { costMicros: 0, costShare: 0 },
      practices: { requestsMeasured: 5, highEffortShare: 0.2, outdatedModels: [] },
      seat: { seat: null, plan: null }
    });
  });

  it('keeps at most 3 outdated models per member, most expensive first', async () => {
    answer({
      outdated: ['a', 'b', 'c', 'd'].map((model, index) => ({
        user: 'aten_ada',
        model,
        'model.status': 'deprecated',
        'model.isLatest': 'true',
        'cost.usd': 4 - index
      }))
    });

    let result = await read({ include: ['practices'] });

    expect(result.list.items[0]!.practices!.outdatedModels.map(item => item.model.id)).toEqual(
      ['a', 'b', 'c']
    );
  });

  it('returns null shares for zero denominators', async () => {
    answer({
      usage: [
        usageRow('aten_ada', 0, {
          requests: 0,
          'cost.list': 0,
          sessions_active: 0,
          models_cost: 0,
          models_requests: 0,
          cost_outdated: 0,
          'cache.hit_rate': null
        })
      ],
      usageTotals: usageRow(null, 0, { requests: 0 }),
      requests: [],
      requestTotals: {}
    });

    let result = await read({ include: all, modelIds: ['claude-sonnet-4-5'] });
    expect(result.summary.models).toMatchObject({ costShare: null, requestShare: null });

    let [ada] = (await read({ include: ['practices', 'seat'] })).list.items;
    expect(ada).toMatchObject({
      share: null,
      practices: {
        requestsMeasured: 0,
        highEffortShare: null,
        fastShare: null,
        outdatedShare: null,
        cacheHitRate: null
      },
      seat: { seat: null, listPriceMicros: 0 }
    });
    expect(result.summary.practices).toMatchObject({
      highEffortShare: null,
      fastShare: null,
      outdatedShare: null
    });
  });

  it('shares fast requests among the requests that reported a speed tier', async () => {
    answer({
      requests: [
        {
          user: 'aten_ada',
          requests: 10,
          requests_with_effort: 0,
          requests_fast: 3,
          requests_with_speed: 4
        }
      ]
    });

    let result = await read({ include: ['practices'], thresholds: { fastShareMin: 0.7 } });
    let [ada, bob] = result.list.items;

    expect(ada!.practices).toMatchObject({ fastShare: 0.75, highEffortShare: null });
    expect(ada!.flags).toEqual(['fast_mode']);
    expect(bob!.practices).toMatchObject({ requestsMeasured: 0, fastShare: null });
    expect(bob!.flags).toEqual([]);
  });

  it('summarizes the organization, including usage without a member', async () => {
    let result = await read({ include: all, modelIds: ['claude-sonnet-4-5'] });

    expect(result.summary).toMatchObject({
      cost: { totalMicros: 5 * dollar },
      requests: 30,
      sessions: 6,
      activeMembers: 2,
      unattributedCostMicros: dollar,
      members: 2,
      models: { costMicros: 1.5 * dollar, requests: 5, costShare: 0.3 },
      practices: {
        requestsMeasured: 18,
        requestsWithEffort: 15,
        highEffortRequests: 5,
        maxEffortRequests: 2,
        fastShare: null,
        cacheHitRate: 0.6
      },
      seat: { unknownSeatMembers: 1 },
      countsCapped: false,
      requestRecordsClipped: false
    });
    expect(result.summary.practices!.highEffortShare).toBeCloseTo(7 / 15, 9);
    expect(result.summary.flagCounts).toEqual({
      model_share: null,
      high_effort: null,
      fast_mode: null,
      outdated_models: null,
      low_cache_hit_rate: null,
      low_usage_seat: null
    });
  });

  it('says when the request records do not reach back to the start of the range', async () => {
    let now = Date.now();
    let span = 90 * dayMs;
    let clipped = await read({
      include: ['seat'],
      range: { from: new Date(now - span - 5 * 60_000), to: new Date(now - 5 * 60_000) }
    });
    let endingNow = await read({
      include: ['seat'],
      range: { from: new Date(now - span), to: new Date(now) }
    });
    let older = await read({
      range: { from: new Date(now - 2 * span), to: new Date(now - span) }
    });

    expect(clipped.summary.requestRecordsClipped).toBe(true);
    expect(endingNow.summary.requestRecordsClipped).toBe(false);
    expect(older.summary.requestRecordsClipped).toBe(false);
  });

  it('says when a distinct count reached its limit', async () => {
    answer({ usageWarnings: [{ code: 'distinct_capped' }] });

    expect((await read()).summary.countsCapped).toBe(true);
  });

  it('leaves the column groups that were not asked for null', async () => {
    let result = await read();

    expect(result.include).toEqual([]);
    for (let item of result.list.items) {
      expect(item).toMatchObject({ models: null, practices: null, seat: null, flags: [] });
    }
    expect(result.summary).toMatchObject({ models: null, practices: null, seat: null });
  });
});

describe('member insights ranking and flags', () => {
  let rows = () => [
    usageRow('aten_cy', 2, { requests: 5 }),
    usageRow('aten_ada', 2, { requests: 7 }),
    usageRow('aten_bob', 4, { requests: 7 }),
    usageRow('aten_dee', 0, { requests: 3, requests_without_cost: 3, 'cost.usd': null })
  ];

  beforeEach(() => {
    resetMocks();
    answer({ usage: rows() });
  });

  it('ranks by cost, highest first, ties by member id and unknown values last', async () => {
    expect(ids(await read())).toEqual([
      ['aten_bob', 1],
      ['aten_ada', 2],
      ['aten_cy', 3],
      ['aten_dee', 4]
    ]);
  });

  it('ranks the other way with order asc, still ties by member id and unknown last', async () => {
    expect(ids(await read({ page: { order: 'asc' } }))).toEqual([
      ['aten_ada', 1],
      ['aten_cy', 2],
      ['aten_bob', 3],
      ['aten_dee', 4]
    ]);
  });

  it('ranks by requests', async () => {
    expect(ids(await read({ sort: 'requests' }))).toEqual([
      ['aten_ada', 1],
      ['aten_bob', 2],
      ['aten_cy', 3],
      ['aten_dee', 4]
    ]);
  });

  it('keeps ranks across pages, from one set of queries', async () => {
    let first = await read({ page: { limit: 2 } });
    expect(ids(first)).toEqual([
      ['aten_bob', 1],
      ['aten_ada', 2]
    ]);
    expect(first.list.pagination.hasNextPage).toBe(true);

    let second = await read({ page: { limit: 2, after: 'aten_ada' } });
    expect(ids(second)).toEqual([
      ['aten_cy', 3],
      ['aten_dee', 4]
    ]);

    expect(callsTo('query:run')).toHaveLength(2);
  });

  it('looks up only the members of the page', async () => {
    await read({ page: { limit: 1 } });

    expect(callsTo('entity:list').at(-1)!.input.ids).toEqual(['aten_bob']);
  });

  it('fires each threshold flag and counts it', async () => {
    answer();

    let result = await read({
      include: all,
      modelIds: ['claude-sonnet-4-5'],
      thresholds: {
        modelShareMin: 0.5,
        highEffortShareMin: 0.5,
        fastShareMin: 0,
        outdatedShareMin: 0.3,
        cacheHitRateMax: 0.5,
        seatUsageMaxMicros: 3 * dollar
      }
    });
    let [ada, bob] = result.list.items;

    expect(ada!.flags).toEqual(['model_share', 'high_effort', 'outdated_models']);
    expect(bob!.flags).toEqual(['low_cache_hit_rate', 'low_usage_seat']);
    expect(result.summary.flagCounts).toEqual({
      model_share: 1,
      high_effort: 1,
      fast_mode: 0,
      outdated_models: 1,
      low_cache_hit_rate: 1,
      low_usage_seat: 1
    });
  });

  it('lists and counts only the members on the named seats, ranked among them', async () => {
    answer();
    let thresholds = { seatUsageMaxMicros: 100 * dollar };

    let unnamed = await read({ include: ['seat'], thresholds, sort: 'seat_usage' });
    expect(unnamed.list.items.map(item => [item.id, item.rank, item.flags])).toEqual([
      ['aten_ada', 1, ['low_usage_seat']],
      ['aten_bob', 2, ['low_usage_seat']]
    ]);
    expect(unnamed.summary).toMatchObject({
      members: 2,
      flagCounts: { low_usage_seat: 2 },
      seat: { unknownSeatMembers: 1 }
    });

    let premium = await read({
      include: ['seat'],
      thresholds,
      seats: ['premium'],
      sort: 'seat_usage',
      page: { order: 'asc' }
    });
    expect(premium.list.items.map(item => [item.id, item.rank, item.flags])).toEqual([
      ['aten_ada', 1, ['low_usage_seat']]
    ]);
    expect(premium.summary).toMatchObject({
      members: 1,
      flagCounts: { low_usage_seat: 1 },
      seat: { unknownSeatMembers: 0 },
      cost: { totalMicros: 5 * dollar }
    });

    let standard = await read({ include: ['seat'], thresholds, seats: ['standard'] });
    expect(standard.list.items).toEqual([]);
    expect(standard.summary).toMatchObject({ members: 0, flagCounts: { low_usage_seat: 0 } });

    expect(queriesOf('usage')).toHaveLength(1);
  });

  it('ranks only the members with requests or cost on the selected models', async () => {
    answer({
      usage: [
        usageRow('aten_ada', 3, { models_cost: 1.5, models_requests: 4 }),
        usageRow('aten_bob', 4, { models_cost: 0, models_requests: 0 }),
        usageRow('aten_cy', 2, { models_cost: 0.2, models_requests: 0 }),
        usageRow('aten_dee', 1, { 'cost.usd': null, models_cost: null, models_requests: 2 })
      ],
      lastActivity: [{ user: 'aten_zed', last_activity: '2026-11-01T10:00:00.000Z' }]
    });
    instanceConsumers.findMany.mockImplementation(async () => [
      { consumer: { id: 'con_yan' } }
    ]);

    let result = await read({
      include: ['models'],
      modelIds: ['claude-sonnet-4-5'],
      includeInactive: true,
      sort: 'model_cost'
    });

    expect(ids(result)).toEqual([
      ['aten_ada', 1],
      ['aten_cy', 2],
      ['aten_dee', 3]
    ]);
    expect(result.summary.members).toBe(3);
    expect(result.truncated).toBe(false);
    expect(instanceConsumers.findMany).not.toHaveBeenCalled();

    answer({ usage: [usageRow('aten_bob', 4, { models_cost: 0, models_requests: 0 })] });
    let none = await read({ include: ['models'], modelIds: ['claude-opus-4-1'] });
    expect(none.list.items).toEqual([]);
    expect(none.summary.members).toBe(0);
  });

  it('puts members never active first when ranking by last activity ascending, else last', async () => {
    answer({
      usage: [usageRow('aten_ada', 3), usageRow('aten_bob', 2), usageRow('aten_cy', 1)],
      lastActivity: [
        { user: 'aten_ada', last_activity: '2026-11-18T10:00:00.000Z' },
        { user: 'aten_cy', last_activity: '2026-11-10T10:00:00.000Z' }
      ]
    });

    expect(ids(await read({ sort: 'last_activity', page: { order: 'asc' } }))).toEqual([
      ['aten_bob', 1],
      ['aten_cy', 2],
      ['aten_ada', 3]
    ]);
    expect(ids(await read({ sort: 'last_activity' }))).toEqual([
      ['aten_ada', 1],
      ['aten_cy', 2],
      ['aten_bob', 3]
    ]);
  });

  it('flags a member without usage only as a low usage seat', async () => {
    answer({
      usage: [
        usageRow('aten_ada', 3, { 'cache.hit_rate': 0.8 }),
        usageRow('aten_zed', 0, {
          requests: 0,
          'cost.list': 0,
          sessions_active: 0,
          cost_outdated: 0,
          'cache.hit_rate': null
        })
      ],
      lastActivity: [{ user: 'aten_zed', last_activity: '2026-05-01T10:00:00.000Z' }],
      requests: []
    });

    let result = await read({
      include: ['practices', 'seat'],
      includeInactive: true,
      thresholds: {
        highEffortShareMin: 0,
        fastShareMin: 0,
        outdatedShareMin: 0,
        cacheHitRateMax: 1,
        seatUsageMaxMicros: 1
      }
    });

    expect(result.list.items.find(item => item.id == 'aten_zed')).toMatchObject({
      requests: 0,
      cost: { totalMicros: 0 },
      flags: ['low_usage_seat']
    });
  });

  it('returns only flagged members when asked, ranked among all', async () => {
    answer();

    let result = await read({
      include: ['practices'],
      thresholds: { cacheHitRateMax: 0.5 },
      flaggedOnly: true
    });

    expect(ids(result)).toEqual([['aten_bob', 2]]);
    expect(result.summary.members).toBe(2);
  });

  it('sorts by a practice figure', async () => {
    answer();

    expect(ids(await read({ include: ['practices'], sort: 'cache_hit_rate' }))).toEqual([
      ['aten_ada', 1],
      ['aten_bob', 2]
    ]);
    expect(
      ids(
        await read({ include: ['practices'], sort: 'cache_hit_rate', page: { order: 'asc' } })
      )
    ).toEqual([
      ['aten_bob', 1],
      ['aten_ada', 2]
    ]);
  });
});

describe('member insights cache, limits and access', () => {
  beforeEach(() => {
    resetMocks();
    answer();
  });

  it('applies sort, order, thresholds, seats, filters and paging without asking again', async () => {
    let base = { include: ['practices', 'seat'] as MemberInsightsGroup[] };
    let reads = [
      {},
      { sort: 'requests' as const },
      { page: { order: 'asc' as const, limit: 1 } },
      { thresholds: { cacheHitRateMax: 0.5, seatUsageMaxMicros: 1 } },
      { seats: ['premium'] },
      { flaggedOnly: true }
    ];

    for (let extra of reads) await read({ ...base, ...extra });

    expect(queriesOf('usage')).toHaveLength(1);
  });

  it('asks again for other groups, models, ranges or members without usage', async () => {
    let reads = [
      {},
      { include: ['practices'] as MemberInsightsGroup[] },
      { include: ['models'] as MemberInsightsGroup[], modelIds: ['a'] },
      { include: ['models'] as MemberInsightsGroup[], modelIds: ['b'] },
      { range: { preset: 'last_7_days' as const } },
      { includeInactive: true }
    ];

    for (let extra of [...reads, ...reads]) await read(extra);

    expect(queriesOf('usage')).toHaveLength(reads.length);
  });

  it('shares one cache entry for the same models in any order', async () => {
    let include: MemberInsightsGroup[] = ['models'];

    await read({ include, modelIds: ['b', 'a'] });
    await read({ include, modelIds: ['a', 'b', 'a'] });

    expect(queriesOf('usage')).toHaveLength(1);
  });

  it('says when any result set was capped', async () => {
    for (let kind of ['usage', 'sessions', 'requests', 'outdated'] as const) {
      resetMocks();
      answer({ truncated: kind });

      expect((await read({ include: ['practices'] })).truncated, kind).toBe(true);
    }

    resetMocks();
    answer();
    expect((await read({ include: ['practices'] })).truncated).toBe(false);
  });

  it('refuses practices and seat over more than 90 days, before asking', async () => {
    let from = new Date('2026-06-01T00:00:00Z');
    let longRange = { from, to: new Date(from.getTime() + 90 * dayMs + 1) };

    for (let include of [['practices'], ['seat']] as MemberInsightsGroup[][]) {
      let error = await rejection(read({ include, range: longRange }));
      expect(error).toMatchObject({ status: 400 });
      expect(error.message).toContain('90 days');
    }
    expect(callsTo('query:run')).toHaveLength(0);

    await read({
      include: ['seat'],
      range: { from, to: new Date(from.getTime() + 90 * dayMs) }
    });
    await read({ range: { from, to: new Date(from.getTime() + 200 * dayMs) } });
    expect(queriesOf('usage')).toHaveLength(2);
  });

  it('validates sorts, model ids and thresholds against the groups asked for', async () => {
    let invalidReads = [
      { sort: 'model_share' as const },
      { sort: 'cache_hit_rate' as const, include: ['seat'] as MemberInsightsGroup[] },
      { sort: 'seat_usage' as const },
      { include: ['models'] as MemberInsightsGroup[] },
      { modelIds: ['claude-sonnet-4-5'] },
      { seats: ['premium'] },
      { thresholds: { modelShareMin: 0.5 } },
      { thresholds: { cacheHitRateMax: 0.5 } },
      { thresholds: { seatUsageMaxMicros: 5 } }
    ];

    for (let invalidRead of invalidReads) {
      expect(await rejection(read(invalidRead)), JSON.stringify(invalidRead)).toMatchObject({
        status: 400,
        code: 'bad_request'
      });
    }
    expect(callsTo('query:run')).toHaveLength(0);
  });

  it('is refused while the organization hides individuals, before asking', async () => {
    privacy.hideIndividuals = true;

    let error = await rejection(read({ include: all, modelIds: ['a'] }));

    expect(error).toMatchObject({ status: 403, code: 'agent_tracking_individuals_hidden' });
    expect(rpc.calls).toHaveLength(0);
  });
});

describe('member insights without usage', () => {
  let consumerRows = (ids: string[]) => ids.map(id => ({ consumer: { id } }));

  let entityOf = (ref: string) => {
    if (ref == 'con_unsynced') throw new ServiceError(notFoundError('entity', ref));
    if (ref == 'con_old') {
      return remoteMember({ id: 'aten_old', status: 'merged', mergedIntoId: 'aten_new' });
    }

    return remoteMember({ id: ref.replace('con_', 'aten_'), ref });
  };

  beforeEach(() => {
    resetMocks();
    answer({
      usage: [
        usageRow('aten_ada', 3),
        usageRow('aten_unpriced', 0, {
          'cost.usd': null,
          requests: 4,
          requests_without_cost: 4
        }),
        usageRow('aten_credit', -2)
      ],
      lastActivity: [
        { user: 'aten_seen', last_activity: '2026-05-01T10:00:00.000Z' },
        { user: 'aten_ada', last_activity: '2026-11-18T10:00:00.000Z' }
      ]
    });
    rpc.handlers['entity:getByRef'] = ({ ref }) => entityOf(ref);
    instanceConsumers.findMany.mockImplementation(async () =>
      consumerRows(['con_ada', 'con_seen', 'con_here', 'con_unsynced', 'con_old'])
    );
  });

  it('keeps every member with usage and adds members of this instance without usage', async () => {
    let result = await read({ includeInactive: true, page: { limit: 50 } });

    expect(queriesOf('usage')[0].fill).toBeUndefined();
    expect(result.list.items.map(item => item.id)).toEqual([
      'aten_ada',
      'aten_here',
      'aten_new',
      'aten_seen',
      'aten_credit',
      'aten_unpriced'
    ]);
    expect(result.list.items.find(item => item.id == 'aten_seen')).toMatchObject({
      requests: 0,
      sessions: 0,
      cost: { totalMicros: 0, listPriceMicros: 0 },
      lastActivityAt: new Date('2026-05-01T10:00:00.000Z')
    });
    expect(result.list.items.find(item => item.id == 'aten_here')!.lastActivityAt).toBeNull();
    expect(result.truncated).toBe(false);
    expect(result.summary.members).toBe(6);
    expect(instanceConsumers.findMany.mock.calls[0]![0]).toMatchObject({
      where: {
        instanceOid: scope.instance.oid,
        isPending: false,
        consumer: { isServiceAccount: false }
      },
      take: maxConsumerLookups + 1
    });
  });

  it('looks up nothing about members without usage unless asked', async () => {
    let result = await read();

    expect(result.list.items.map(item => item.id).sort()).toEqual([
      'aten_ada',
      'aten_credit',
      'aten_unpriced'
    ]);
    expect(instanceConsumers.findMany).not.toHaveBeenCalled();
    expect(callsTo('entity:getByRef')).toHaveLength(0);
  });

  it('fills only the room members with usage leave, and says so when it cuts', async () => {
    let active = Array.from({ length: maxInsightMembers - 1 }, (_, index) =>
      usageRow(`aten_${String(index).padStart(4, '0')}`, 1)
    );
    answer({
      usage: active,
      lastActivity: [
        { user: 'aten_recent', last_activity: '2026-11-01T10:00:00.000Z' },
        { user: 'aten_older', last_activity: '2026-06-01T10:00:00.000Z' }
      ]
    });
    rpc.handlers['entity:getByRef'] = ({ ref }) => entityOf(ref);

    let result = await read({ includeInactive: true, page: { limit: 1 } });

    expect(result.summary.members).toBe(maxInsightMembers);
    expect(result.truncated).toBe(true);

    let last = await read({
      includeInactive: true,
      page: { limit: 1 },
      sort: 'last_activity'
    });
    expect(last.list.items.map(item => item.id)).toEqual(['aten_recent']);
  });

  it('says the list is cut when this instance has more consumers than fit', async () => {
    instanceConsumers.findMany.mockImplementation(async (query: any) =>
      consumerRows(
        Array.from(
          { length: query.take },
          (_, index) => `con_${String(index).padStart(5, '0')}`
        )
      )
    );

    let result = await read({ includeInactive: true });

    expect(result.truncated).toBe(true);
    expect(callsTo('entity:getByRef')).toHaveLength(maxConsumerLookups);
    expect(result.summary.members).toBe(4 + maxConsumerLookups);
  });

  it('says nothing was cut when every consumer was looked up', async () => {
    let result = await read({ includeInactive: true });

    expect(callsTo('entity:getByRef')).toHaveLength(5);
    expect(result.truncated).toBe(false);
  });
});

describe('member insights practices and seats', () => {
  beforeEach(() => resetMocks());

  it('shares effort among the requests that reported one', async () => {
    answer({
      requests: [
        {
          user: 'aten_ada',
          requests: 10,
          requests_high_effort: 1,
          requests_max_effort: 1,
          requests_with_effort: 4
        }
      ]
    });

    let [ada] = (await read({ include: ['practices'] })).list.items;

    expect(ada!.practices).toMatchObject({
      requestsMeasured: 10,
      requestsWithEffort: 4,
      highEffortShare: 0.5
    });
  });

  it('shows the seat and plan reported together, else the plan alone', async () => {
    let row = (user: string, seat: string | null, plan: string | null, requests: number) => ({
      user,
      'billing.seat': seat,
      'billing.plan': plan,
      requests
    });
    answer({
      requests: [
        row('aten_ada', 'premium', 'team', 3),
        row('aten_ada', 'premium', 'max', 3),
        row('aten_ada', null, 'enterprise', 9),
        row('aten_bob', null, 'team', 2),
        row('aten_bob', null, 'max', 2)
      ]
    });

    let [ada, bob] = (await read({ include: ['seat'] })).list.items;

    expect(ada!.seat).toMatchObject({ seat: 'premium', plan: 'max' });
    expect(bob!.seat).toMatchObject({ seat: null, plan: 'max' });
  });

  it('counts outdated cost on the same models it lists as outdated', async () => {
    answer();

    await read({ include: ['practices'] });

    let outdatedCost = queriesOf('usage')[0].measures.find(
      (measure: any) => measure.as == 'cost_outdated'
    );
    let outdatedModels = queriesOf('outdated')[0].where;
    expect(outdatedCost.where).toEqual(outdatedModels);
    expect(outdatedModels).toEqual({
      or: [
        { field: 'model.status', op: 'in', value: ['deprecated', 'retired'] },
        {
          and: [
            { field: 'model.isLatest', op: 'eq', value: false },
            { field: 'model.family', op: 'notNull' }
          ]
        }
      ]
    });
  });

  it('keeps the members with the most use of the selected models within the member limit', async () => {
    answer();

    await read();
    await read({ include: ['models'], modelIds: ['claude-sonnet-4-5'] });

    let [all, byModels] = queriesOf('usage');
    expect(all.orderBy).toEqual([{ by: 'cost.usd', direction: 'desc' }]);
    expect(byModels.orderBy).toEqual([
      { by: 'models_cost', direction: 'desc' },
      { by: 'models_requests', direction: 'desc' },
      { by: 'cost.usd', direction: 'desc' }
    ]);
    expect(byModels.limit).toBe(maxInsightMembers);
  });

  it('names the outdated models of the page from the catalog', async () => {
    answer();

    let [ada] = (await read({ include: ['practices'] })).list.items;

    expect(ada!.practices!.outdatedModels.map(item => item.model)).toEqual([
      { id: 'claude-3-opus', name: 'Claude 3 Opus' },
      { id: 'claude-sonnet-4', name: null }
    ]);
  });
});

describe('member insights cache payload', () => {
  it('stays small for the largest list with every column group', () => {
    let models = Array.from({ length: 50 }, (_, index) => `claude-model-${index}-20250101`);
    let users = Array.from(
      { length: maxInsightMembers },
      (_, index) => `aten_${String(index).padStart(22, '0')}`
    );
    let range = resolveRange({
      preset: 'last_30_days',
      from: null,
      to: null,
      timeZone: 'UTC'
    });

    let data = buildMemberInsights({
      range,
      now: new Date(),
      include: ['models', 'practices', 'seat'],
      usage: {
        rows: users.map((user, index) =>
          usageRow(user, 1234.567891234 + index, {
            'cost.list': 2345.678912345 + index,
            'cost.reported': [
              { unit: 'usd', basis: 'billed', amount: 123.456789012 },
              { unit: 'usd', basis: 'client_estimate', amount: 1234.567891234 }
            ],
            requests: 123456,
            requests_without_cost: 1234,
            requests_without_list_price: 1234,
            sessions_active: 1234,
            models_cost: 345.678912345,
            models_requests: 12345,
            cost_outdated: 456.789123456,
            'cache.hit_rate': 0.123456789012
          })
        ),
        totals: usageRow(null, 1_000_000)
      },
      lastActivity: {
        rows: users.map(user => ({ user, last_activity: '2026-11-18T10:00:00.000Z' }))
      },
      requests: {
        rows: users.map(user => ({
          user,
          'billing.seat': 'usage_based_premium',
          'billing.plan': 'enterprise_annual',
          requests: 123456,
          requests_high_effort: 12345,
          requests_max_effort: 12345,
          requests_with_effort: 123456,
          requests_fast: 12345,
          requests_with_speed: 12345
        }))
      },
      outdated: {
        rows: users.flatMap((user, index) =>
          [0, 1, 2].map(offset => ({
            user,
            model: models[(index + offset) % models.length],
            'model.status': 'deprecated',
            'model.isLatest': 'false',
            'cost.usd': 123.456789012
          }))
        )
      },
      inactive: null
    });

    let bytes = Buffer.byteLength(JSON.stringify(data));

    expect(data.rows).toHaveLength(maxInsightMembers);
    expect(bytes).toBeLessThan(600_000);
  });
});
