import { ServiceError, tooManyRequestsError } from '@lowerdeck/error';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { calendarDateKey, shiftDays } from '../src/lib/range';
import { agentTrackingSpendService } from '../src/services/agentTrackingSpend';
import {
  cache,
  callsTo,
  privacy,
  rejection,
  remoteMember,
  resetMocks,
  rpc,
  scope
} from './_mocks';

let dollar = 1_000_000;

let figures = (cost: number, extra: Record<string, unknown> = {}) => ({
  'cost.usd': cost,
  'cost.list': cost,
  'cost.reported': [{ unit: 'usd', basis: 'client_estimate', amount: cost }],
  requests: 4,
  requests_without_cost: 0,
  requests_without_list_price: 0,
  tokens: { inputUncached: 1, cacheRead: 1, cacheWrite: 1, output: 1, reasoning: 0, total: 4 },
  ...extra
});

let now = new Date('2026-11-22T12:00:00Z');

let utcDay = (date: string) => `${date}T00:00:00+00:00`;

let daysOf = (from: string, count: number, row: (date: string) => Record<string, unknown>) =>
  Array.from({ length: count }, (_, index) => {
    let [year, month, day] = from.split('-').map(Number) as [number, number, number];
    let date = calendarDateKey(shiftDays({ year, month, day }, index));
    return { 'time.day': utcDay(date), ...row(date) };
  });

type Answers = {
  daily?: Record<string, unknown>[];
  monthly?: Record<string, unknown>[];
  monthlyTotals?: Record<string, unknown>;
  groups?: Record<string, { rows: Record<string, unknown>[]; labels?: unknown }>;
  fail?: (query: any) => unknown;
  delayMs?: (query: any) => number;
};

let inFlight = { now: 0, max: 0 };

let answer = (answers: Answers) => {
  rpc.handlers['entity:list'] = () => ({ items: [remoteMember()], pagination: {} });
  rpc.handlers['query:run'] = (async ({ query }: any) => {
    inFlight.now++;
    inFlight.max = Math.max(inFlight.max, inFlight.now);
    await new Promise(resolve => setTimeout(resolve, answers.delayMs?.(query) ?? 5));
    inFlight.now--;

    let failure = answers.fail?.(query);
    if (failure) throw failure;

    let dimension = query.dimensions[0];
    if (dimension == 'time.day') {
      return { rows: answers.daily ?? [], totals: figures(0), labels: {}, meta: {} };
    }
    if (dimension == 'time.month') {
      return {
        rows: answers.monthly ?? [],
        totals: answers.monthlyTotals ?? figures(0),
        labels: {},
        meta: {}
      };
    }

    let group = answers.groups?.[dimension];
    return {
      rows: group?.rows ?? [],
      totals: figures(0),
      labels: { [dimension]: group?.labels ?? {} },
      meta: {}
    };
  }) as any;
};

beforeEach(() => {
  resetMocks();
  inFlight.now = 0;
  inFlight.max = 0;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
});

afterEach(() => vi.useRealTimers());

describe('spend report of the current year', () => {
  let sharedAnswers = (): Answers => ({
    daily: daysOf('2026-01-01', 326, date =>
      date >= '2026-11-01' ? figures(2) : { 'cost.usd': 0, requests: 0 }
    ),
    monthly: [
      { 'time.month': '2026-10-01T00:00:00+00:00', ...figures(0, { requests: 0 }) },
      {
        'time.month': '2026-11-01T00:00:00+00:00',
        ...figures(44),
        sessions_active: 9,
        members_active: 3
      }
    ],
    monthlyTotals: { ...figures(44), sessions_active: 9, members_active: 3 },
    groups: {
      model: {
        rows: [{ model: 'claude-sonnet-4-5', ...figures(44), share: 1 }],
        labels: { 'claude-sonnet-4-5': { name: 'Claude Sonnet 4.5' } }
      },
      'client.family': {
        rows: [
          { 'client.family': 'claude-code', ...figures(40), share: 40 / 44 },
          { 'client.family': null, ...figures(4), share: 4 / 44 }
        ]
      },
      user: { rows: [{ user: 'aten_ada', ...figures(44), share: 1 }] }
    }
  });

  it('asks for the year by month, the days since the December before, and the top models, clients and members, 3 at a time', async () => {
    answer(sharedAnswers());

    await agentTrackingSpendService.getReport({ ...scope, timeZone: 'Europe/Berlin' });

    let queries = callsTo('query:run').map(call => call.input.query);
    expect(queries).toHaveLength(5);
    expect(inFlight.max).toBe(3);

    let [daily, monthly, ...lists] = queries;
    expect(daily).toMatchObject({
      dimensions: ['time.day'],
      timeZone: 'Europe/Berlin',
      range: { from: '2025-11-30T23:00:00.000Z', to: now.toISOString() },
      fill: { time: 'zero' }
    });
    expect(monthly).toMatchObject({
      dimensions: ['time.month'],
      range: { from: '2025-12-31T23:00:00.000Z', to: now.toISOString() },
      fill: { time: 'zero' },
      totals: true
    });
    expect(lists.map(query => query.dimensions)).toEqual([
      ['model'],
      ['client.family'],
      ['user']
    ]);
    expect(lists.map(query => query.limit)).toEqual([50, 50, 1000]);
    for (let query of lists) {
      expect(query).toMatchObject({ other: true, totals: true });
      expect(query.range).toEqual(monthly!.range);
    }
  });

  it('lists up to 1,000 members, then the rest as other, in a small cache entry', async () => {
    let answers = sharedAnswers();
    let users = Array.from(
      { length: 1000 },
      (_, index) => `aten_${String(index).padStart(22, '0')}`
    );
    answer({
      ...answers,
      groups: {
        ...answers.groups,
        user: {
          rows: [
            ...users.map(user => ({ user, ...figures(1.234567891), share: 0.000987654321 })),
            { user: '$other', ...figures(12.345678912), share: 0.0123456789 }
          ]
        }
      }
    });
    rpc.handlers['entity:list'] = ({ ids }) => ({
      items: ids.map((id: string) =>
        remoteMember({
          id,
          ref: id,
          name: 'Ada Lovelace-Byron',
          identifiers: [{ type: 'email', value: `${id}@example.com`, createdAt: new Date() }]
        })
      ),
      pagination: {}
    });

    let report = await agentTrackingSpendService.getReport(scope);

    expect(report.breakdowns.member).toHaveLength(1001);
    expect(report.breakdowns.member!.at(-1)).toMatchObject({ kind: 'other', key: 'other' });
    expect(callsTo('entity:list')).toHaveLength(10);

    let bytes = Math.max(
      ...[...cache.store.values()].map(entry => Buffer.byteLength(JSON.stringify(entry.value)))
    );
    expect(bytes).toBeLessThan(800_000);
  });

  it('starts the days at the December before also in January', async () => {
    vi.setSystemTime(new Date('2026-01-10T12:00:00Z'));
    answer({});

    let report = await agentTrackingSpendService.getReport(scope);

    let [daily, monthly] = callsTo('query:run').map(call => call.input.query);
    expect(daily!.range.from).toBe('2025-12-01T00:00:00.000Z');
    expect(monthly!.range.from).toBe('2026-01-01T00:00:00.000Z');
    expect(report.months.map(month => month.month)).toEqual(['2026-01']);
  });

  it('presents months from January to now, the year so far, coverage and the lists', async () => {
    answer(sharedAnswers());

    let report = await agentTrackingSpendService.getReport(scope);

    expect(report.year).toBe(2026);
    expect(report.range).toEqual({
      preset: null,
      from: new Date('2026-01-01T00:00:00Z'),
      to: now,
      timeZone: 'UTC'
    });
    expect(report.months.map(month => month.month)).toEqual(
      Array.from({ length: 11 }, (_, index) => `2026-${String(index + 1).padStart(2, '0')}`)
    );
    expect(report.months[0]).toMatchObject({ requests: 0, cost: { totalMicros: 0 } });
    expect(report.months[10]).toMatchObject({
      startsAt: new Date('2026-11-01T00:00:00Z'),
      hiddenDays: 0,
      requests: 4,
      cost: { totalMicros: 44 * dollar },
      counts: { sessions: 9, members: 3 }
    });
    expect(report.total.cost.totalMicros).toBe(44 * dollar);
    expect(report.counts).toEqual({ sessions: 9, members: 3, capped: false });

    expect(report.coverage).toEqual({
      firstDay: '2026-11-01',
      daysWithData: 22,
      hiddenDays: 0,
      startsBeforeYear: false,
      lastFullDay: '2026-11-21'
    });

    expect(report.breakdowns.model).toEqual([
      expect.objectContaining({
        kind: 'model',
        key: 'claude-sonnet-4-5',
        model: { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
        client: null
      })
    ]);
    expect(report.breakdowns.client!.map(item => [item.kind, item.key, item.client])).toEqual([
      ['client', 'claude_code', { family: 'claude_code', name: 'Claude Code' }],
      ['unknown', 'unknown', null]
    ]);
    expect(report.breakdowns.member).toEqual([
      expect.objectContaining({ kind: 'member', key: 'aten_ada', client: null })
    ]);
  });

  it('projects from the days so far and the rest of today', async () => {
    answer(sharedAnswers());

    let report = await agentTrackingSpendService.getReport({ ...scope, growthRate: 0.1 });

    expect(report.projection).toMatchObject({
      status: 'projected',
      baseline: {
        from: '2026-11-02',
        to: '2026-11-21',
        days: 20,
        dailyRateMicros: 2 * dollar
      },
      growth: { rate: 0.1, source: 'input' }
    });
    expect(report.projection.scenarios!.flat.months[0]).toEqual({
      month: '2026-11',
      actualMicros: 44 * dollar,
      projectedMicros: 17 * dollar,
      totalMicros: 61 * dollar
    });
  });

  it('keeps averaging 30 days when usage started last year and paused in January', async () => {
    vi.setSystemTime(new Date('2026-02-05T12:00:00Z'));
    answer({
      daily: daysOf('2025-12-01', 67, date =>
        date >= '2026-01-20'
          ? figures(3)
          : date >= '2025-12-10' && date < '2026-01-01'
            ? figures(1)
            : { 'cost.usd': 0, requests: 0 }
      )
    });

    let report = await agentTrackingSpendService.getReport(scope);

    expect(report.coverage).toMatchObject({ firstDay: '2026-01-20', startsBeforeYear: true });
    expect(report.projection.baseline).toEqual({
      from: '2026-01-06',
      to: '2026-02-04',
      days: 30,
      dailyRateMicros: 1.6 * dollar
    });
  });

  it('counts January as a complete month when usage started last year', async () => {
    vi.setSystemTime(new Date('2026-04-10T12:00:00Z'));
    let month = (key: string, cost: number) => ({
      'time.month': `${key}-01T00:00:00+00:00`,
      ...figures(cost)
    });
    answer({
      daily: daysOf('2025-12-01', 131, date =>
        date >= '2025-12-15' && date != '2026-01-01'
          ? figures(1)
          : { 'cost.usd': 0, requests: 0 }
      ),
      monthly: [month('2026-01', 31), month('2026-02', 1.1 * 28), month('2026-03', 1.21 * 31)]
    });

    let report = await agentTrackingSpendService.getReport(scope);

    expect(report.coverage).toMatchObject({ firstDay: '2026-01-02', startsBeforeYear: true });
    expect(report.projection.growth!.source).toBe('observed');
    expect(report.projection.growth!.rate).toBeCloseTo(0.1, 6);
  });

  it('computes another growth rate from the cached actuals without asking again', async () => {
    answer(sharedAnswers());

    let first = await agentTrackingSpendService.getReport(scope);
    let second = await agentTrackingSpendService.getReport({ ...scope, growthRate: 0.5 });

    expect(callsTo('query:run')).toHaveLength(5);
    expect(first.projection.growth).toEqual({ rate: 0, source: 'default' });
    expect(second.projection.growth).toEqual({ rate: 0.5, source: 'input' });
    expect(second.months).toEqual(first.months);
  });
});

describe('spend report queries', () => {
  let busy = () =>
    new ServiceError(
      tooManyRequestsError({ message: 'busy', reason: 'query_concurrency_limit' })
    );

  it('retries a busy service for the one query, keeping the others', async () => {
    let refused = false;
    answer({
      fail: query => {
        if (query.dimensions?.[0] != 'model' || refused) return null;
        refused = true;
        return busy();
      }
    });

    let report = await agentTrackingSpendService.getReport(scope);

    let dimensions = callsTo('query:run').map(call => call.input.query.dimensions[0]);
    expect(dimensions.sort()).toEqual(
      ['client.family', 'model', 'model', 'time.day', 'time.month', 'user'].sort()
    );
    expect(report.breakdowns.model).toEqual([]);
  });

  it('waits for the queries in flight and starts no more once one fails', async () => {
    answer({
      fail: query =>
        query.dimensions?.[0] == 'time.day'
          ? new ServiceError(tooManyRequestsError({}))
          : null,
      delayMs: query => (query.dimensions?.[0] == 'time.day' ? 1 : 30)
    });

    let error = await rejection(agentTrackingSpendService.getReport(scope));

    expect(error.status).toBe(429);
    expect(inFlight.now).toBe(0);
    expect(callsTo('query:run')).toHaveLength(3);
  });
});

describe('spend report of last year', () => {
  it('covers the whole year and projects nothing', async () => {
    answer({ daily: daysOf('2025-03-01', 3, () => figures(1)) });

    let report = await agentTrackingSpendService.getReport({ ...scope, year: 2025 });

    let [daily] = callsTo('query:run').map(call => call.input.query);
    expect(daily!.range).toEqual({
      from: '2024-12-01T00:00:00.000Z',
      to: '2026-01-01T00:00:00.000Z'
    });
    expect(report.months).toHaveLength(12);
    expect(report.coverage).toMatchObject({
      firstDay: '2025-03-01',
      daysWithData: 3,
      lastFullDay: '2025-12-31'
    });
    expect(report.projection).toEqual({
      status: 'not_applicable',
      baseline: null,
      growth: null,
      scenarios: null
    });
  });
});

describe('spend report validation', () => {
  it('rejects a year to come, a year too far back and a bad time zone', async () => {
    answer({});

    for (let input of [{ year: 2027 }, { year: 2024 }, { timeZone: 'Mars/Olympus' }]) {
      expect(
        (await rejection(agentTrackingSpendService.getReport({ ...scope, ...input }))).status
      ).toBe(400);
    }

    expect(callsTo('query:run')).toHaveLength(0);
  });

  it('shares one cache entry between spellings of a time zone and returns its canonical name', async () => {
    answer({});

    let lower = await agentTrackingSpendService.getReport({
      ...scope,
      timeZone: 'europe/berlin'
    });
    let asked = callsTo('query:run').length;
    let canonical = await agentTrackingSpendService.getReport({
      ...scope,
      timeZone: 'Europe/Berlin'
    });

    expect(callsTo('query:run')).toHaveLength(asked);
    expect(lower.range.timeZone).toBe('Europe/Berlin');
    expect(canonical.range.timeZone).toBe('Europe/Berlin');
  });

  it('counts the current year in the time zone', async () => {
    vi.setSystemTime(new Date('2026-12-31T20:00:00Z'));
    answer({});

    let report = await agentTrackingSpendService.getReport({
      ...scope,
      timeZone: 'Asia/Tokyo'
    });

    expect(report.year).toBe(2027);
    expect(report.months.map(month => month.month)).toEqual(['2027-01']);
    expect(report.coverage.lastFullDay).toBeNull();
  });
});

describe('spend report with individuals hidden', () => {
  beforeEach(() => {
    privacy.hideIndividuals = true;
    privacy.minGroupUsers = 3;
  });

  it('counts whole UTC days up to yesterday, hides small days and leaves out every list', async () => {
    answer({
      daily: daysOf('2025-12-01', 356, date =>
        date >= '2026-11-01'
          ? figures(2, { members_active: date == '2026-11-05' ? 1 : 4 })
          : { 'cost.usd': 0, requests: 0, members_active: 0 }
      ),
      monthly: [
        {
          'time.month': '2026-11-01T00:00:00+00:00',
          ...figures(42),
          sessions_active: 9,
          members_active: 5
        }
      ],
      monthlyTotals: { ...figures(42), sessions_active: 9, members_active: 5 }
    });

    let report = await agentTrackingSpendService.getReport({
      ...scope,
      timeZone: 'Asia/Tokyo'
    });

    let queries = callsTo('query:run').map(call => call.input.query);
    expect(queries.map(query => query.dimensions)).toEqual([['time.day'], ['time.month']]);
    expect(queries[1]).toMatchObject({
      timeZone: 'UTC',
      range: { from: '2026-01-01T00:00:00.000Z', to: '2026-11-22T00:00:00.000Z' }
    });

    expect(report.breakdowns).toEqual({ model: null, client: null, member: null });
    expect(report.privacy).toEqual({
      hideIndividuals: true,
      minGroupUsers: 3,
      hiddenGroups: true
    });
    expect(report.total.cost.totalMicros).toBe(40 * dollar);
    expect(report.counts).toBeNull();
    expect(report.months[9]).toMatchObject({ hiddenDays: 0, counts: null });
    expect(report.months[10]).toMatchObject({
      hiddenDays: 1,
      cost: { totalMicros: 40 * dollar },
      counts: null
    });
    expect(report.coverage).toEqual({
      firstDay: '2026-11-01',
      daysWithData: 21,
      hiddenDays: 1,
      startsBeforeYear: false,
      lastFullDay: '2026-11-21'
    });

    expect(report.projection).toMatchObject({
      status: 'projected',
      baseline: { from: '2026-11-02', to: '2026-11-21', days: 19, dailyRateMicros: 2 * dollar }
    });
    expect(report.projection.scenarios!.flat.months[0]).toMatchObject({
      actualMicros: 40 * dollar,
      projectedMicros: 18 * dollar
    });
  });

  it('keeps the counts of a month without hidden days', async () => {
    answer({
      daily: daysOf('2025-12-01', 356, date =>
        date.startsWith('2026-10') ? figures(1, { members_active: 4 }) : { members_active: 0 }
      ),
      monthly: [
        {
          'time.month': '2026-10-01T00:00:00+00:00',
          ...figures(31),
          sessions_active: 12,
          members_active: 6
        }
      ]
    });

    let report = await agentTrackingSpendService.getReport(scope);

    expect(report.months[9]).toMatchObject({
      hiddenDays: 0,
      cost: { totalMicros: 31 * dollar },
      counts: { sessions: 12, members: 6 }
    });
    expect(report.counts).toMatchObject({ capped: false });
  });
});
