import { isServiceError } from '@lowerdeck/error';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { privateRange, sumSpendCells } from '../src/lib/privateSpend';
import { agentTrackingFilterValueService } from '../src/services/agentTrackingFilterValue';
import { agentTrackingMemberService } from '../src/services/agentTrackingMember';
import { agentTrackingSessionService } from '../src/services/agentTrackingSession';
import { agentTrackingSpendService } from '../src/services/agentTrackingSpend';
import { callsTo, privacy, resetMocks, rpc, scope } from './_mocks';

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

let rejection = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    if (isServiceError(error)) return error.data;
    throw error;
  }

  throw new Error('Expected a rejection');
};

let hideIndividuals = (minGroupUsers = 5) => {
  privacy.hideIndividuals = true;
  privacy.minGroupUsers = minGroupUsers;
};

let now = new Date('2026-11-20T10:00:00Z');

let day = (date: string) => `${date}T00:00:00+00:00`;

beforeEach(() => {
  resetMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
});

afterEach(() => vi.useRealTimers());

describe('sumSpendCells', () => {
  it('adds up amounts, counts, reported costs and tokens', () => {
    let total = sumSpendCells([figures(1.5), figures(0.25)]);

    expect(total).toMatchObject({ 'cost.usd': 1_750_000_000n, requests: 8 });
    expect(total['cost.reported']).toHaveLength(2);
    expect(total.tokens).toMatchObject({ output: 2, total: 8 });
  });
});

describe('privateRange', () => {
  it('counts whole UTC days and leaves out the day in progress', () => {
    expect(privateRange('last_7_days', now)).toMatchObject({
      preset: 'last_7_days',
      from: new Date('2026-11-13T00:00:00Z'),
      to: new Date('2026-11-20T00:00:00Z'),
      timeZone: 'UTC'
    });
    expect(privateRange('last_month', now)).toMatchObject({
      from: new Date('2026-10-01T00:00:00Z'),
      to: new Date('2026-11-01T00:00:00Z')
    });
    expect(privateRange('month_to_date', new Date('2026-11-01T08:00:00Z'))).toBeNull();
  });
});

describe('timeline with individuals hidden', () => {
  let answer = (d: {
    current: Record<string, unknown>[];
    previous?: Record<string, unknown>[];
    totals?: Record<string, unknown>;
  }) =>
    (({ query }: any) =>
      query.range.from == '2026-11-13T00:00:00.000Z'
        ? { rows: d.current, totals: d.totals ?? figures(0), labels: {}, meta: {} }
        : { rows: d.previous ?? [], totals: figures(0), labels: {}, meta: {} }) as any;

  it('applies the minimum to each day itself, whatever the engine returned', async () => {
    hideIndividuals(5);
    rpc.handlers['query:run'] = answer({
      current: [
        { 'time.day': day('2026-11-13'), ...figures(2), members_active: 6 },
        { 'time.day': day('2026-11-14'), ...figures(9), members_active: 1 },
        { 'time.day': day('2026-11-15'), 'cost.usd': 0, requests: 0, members_active: 0 }
      ],
      previous: [
        { 'time.day': day('2026-11-06'), ...figures(3), members_active: 5 },
        { 'time.day': day('2026-11-07'), ...figures(4), members_active: 2 }
      ],
      totals: { ...figures(11), sessions_active: 30, members_active: 7 }
    });

    let timeline = await agentTrackingSpendService.getTimeline({
      ...scope,
      range: { preset: 'last_7_days', timeZone: 'Europe/Berlin' }
    });

    let [call] = callsTo('query:run');
    expect(call!.input.query).toMatchObject({
      timeZone: 'UTC',
      range: { from: '2026-11-13T00:00:00.000Z', to: '2026-11-20T00:00:00.000Z' }
    });
    expect(timeline.range).toMatchObject({
      timeZone: 'UTC',
      to: new Date('2026-11-20T00:00:00Z')
    });
    expect(timeline.items.map(item => [item.date, item.hidden])).toEqual([
      ['2026-11-13', false],
      ['2026-11-14', true],
      ['2026-11-15', false],
      ['2026-11-16', true],
      ['2026-11-17', true],
      ['2026-11-18', true],
      ['2026-11-19', true]
    ]);
    expect(timeline.items[1]).toMatchObject({ cost: null, requests: null, counts: null });
    expect(timeline.total.cost.totalMicros).toBe(2000000);
    expect(timeline.total.requests).toBe(4);
    expect(timeline.counts).toBeNull();
    expect(timeline.previous.total.cost.totalMicros).toBe(3000000);
    expect(timeline.previous.hiddenGroups).toBe(true);
    expect(timeline.privacy).toEqual({
      hideIndividuals: true,
      minGroupUsers: 5,
      hiddenGroups: true
    });
  });

  it('keeps the distinct counts while no day is hidden', async () => {
    hideIndividuals(3);
    let rows = Array.from({ length: 7 }, (_, index) => ({
      'time.day': day(`2026-11-${13 + index}`),
      ...figures(1),
      members_active: 3
    }));
    rpc.handlers['query:run'] = answer({
      current: rows,
      totals: { ...figures(7), sessions_active: 12, members_active: 4 }
    });

    let timeline = await agentTrackingSpendService.getTimeline({
      ...scope,
      range: { preset: 'last_7_days' }
    });

    expect(timeline.counts).toMatchObject({ sessions: 12, members: 4 });
    expect(timeline.total.requests).toBe(28);
    expect(timeline.privacy.hiddenGroups).toBe(false);
  });

  it('sums several shown days and leaves out a day below the minimum between them', async () => {
    hideIndividuals(3);
    rpc.handlers['query:run'] = answer({
      current: [
        { 'time.day': day('2026-11-14'), ...figures(1), members_active: 3 },
        { 'time.day': day('2026-11-15'), ...figures(50), members_active: 2 },
        { 'time.day': day('2026-11-16'), ...figures(2), members_active: 4 },
        {
          'time.day': day('2026-11-17'),
          'cost.usd': 0,
          requests: 0,
          'cost.reported': [{ unit: 'usd', basis: 'client_estimate', amount: 7 }],
          members_active: 0
        },
        { 'time.day': day('2026-11-18'), ...figures(4), members_active: 3 }
      ],
      totals: { ...figures(64), sessions_active: 9, members_active: 6 }
    });

    let timeline = await agentTrackingSpendService.getTimeline({
      ...scope,
      range: { preset: 'last_7_days' }
    });

    expect(
      timeline.items.filter(item => !item.hidden && item.requests).map(item => item.date)
    ).toEqual(['2026-11-14', '2026-11-16', '2026-11-18']);
    expect(timeline.items.find(item => item.date == '2026-11-15')!.hidden).toBe(true);
    expect(timeline.items.find(item => item.date == '2026-11-17')!.hidden).toBe(true);
    expect(timeline.total.cost.totalMicros).toBe(7000000);
    expect(timeline.total.requests).toBe(12);
  });

  it('answers whole days on both sides of midnight UTC and never from the day before', async () => {
    hideIndividuals(3);
    rpc.handlers['query:run'] = ({ query }: any) => ({
      rows: [],
      totals: figures(0),
      labels: {},
      meta: {},
      echo: query.range
    });

    vi.setSystemTime(new Date('2026-11-20T23:59:59Z'));
    let before = await agentTrackingSpendService.getTimeline({
      ...scope,
      range: { preset: 'last_7_days' }
    });
    vi.setSystemTime(new Date('2026-11-21T00:00:01Z'));
    let after = await agentTrackingSpendService.getTimeline({
      ...scope,
      range: { preset: 'last_7_days' }
    });

    expect(before.range.to).toEqual(new Date('2026-11-20T00:00:00Z'));
    expect(after.range.to).toEqual(new Date('2026-11-21T00:00:00Z'));
    expect(after.items.map(item => item.date)).toContain('2026-11-20');
    expect(callsTo('query:run')).toHaveLength(4);
  });

  it('rejects filters, explicit ranges and today before asking the service', async () => {
    hideIndividuals();

    for (let input of [
      {
        range: { preset: 'last_7_days' as const },
        filters: { modelIds: ['claude-sonnet-4-5'] }
      },
      {
        range: { preset: 'last_7_days' as const },
        filters: { clientFamilies: ['claude_code'] }
      },
      { range: { preset: 'today' as const } },
      {
        range: { from: new Date('2026-11-01T00:00:00Z'), to: new Date('2026-11-02T00:00:00Z') }
      }
    ]) {
      let error = await rejection(
        agentTrackingSpendService.getTimeline({ ...scope, ...input })
      );
      expect(error).toMatchObject({ status: 403, code: 'agent_tracking_individuals_hidden' });
    }

    expect(callsTo('query:run')).toHaveLength(0);
  });

  it('does not serve a result cached under other privacy settings', async () => {
    rpc.handlers['query:run'] = answer({
      current: [{ 'time.day': day('2026-11-13'), ...figures(1), members_active: 1 }],
      totals: { ...figures(1), sessions_active: 1, members_active: 1 }
    });
    await agentTrackingSpendService.getTimeline({
      ...scope,
      range: { preset: 'last_7_days' }
    });

    hideIndividuals(3);
    let timeline = await agentTrackingSpendService.getTimeline({
      ...scope,
      range: { preset: 'last_7_days' }
    });

    expect(timeline.privacy.hideIndividuals).toBe(true);
    expect(timeline.items[0]!.hidden).toBe(true);
    expect(timeline.total.requests).toBe(0);
  });
});

describe('breakdown with individuals hidden', () => {
  it('is rejected for every grouping before asking the service', async () => {
    hideIndividuals();

    for (let groupBy of ['member', 'model'] as const) {
      let error = await rejection(
        agentTrackingSpendService.getBreakdown({
          ...scope,
          range: { preset: 'last_7_days' },
          groupBy
        })
      );
      expect(error, groupBy).toMatchObject({
        status: 403,
        code: 'agent_tracking_individuals_hidden'
      });
    }

    expect(callsTo('query:run')).toHaveLength(0);
  });
});

describe('reads about individuals with individuals hidden', () => {
  beforeEach(() => hideIndividuals());

  it('rejects the members seen', async () => {
    let error = await rejection(
      agentTrackingMemberService.listMembers({ ...scope, page: { limit: 10 } as any })
    );

    expect(error.code).toBe('agent_tracking_individuals_hidden');
    expect(rpc.calls).toHaveLength(0);
  });

  it('rejects the cost of members and of one member', async () => {
    for (let memberIds of [undefined, ['aten_ada']]) {
      let error = await rejection(
        agentTrackingMemberService.listMembers({
          ...scope,
          page: { limit: 10 } as any,
          range: { preset: 'last_7_days' },
          memberIds
        })
      );

      expect(error).toMatchObject({ status: 403, code: 'agent_tracking_individuals_hidden' });
    }

    expect(rpc.calls).toHaveLength(0);
  });

  it('rejects the session list and a session', async () => {
    let paginator = agentTrackingSessionService.listSessions({ ...scope, orderBy: 'cost' });

    expect((await rejection(paginator.run({ limit: 4 } as any))).status).toBe(403);
    expect(
      (
        await rejection(
          agentTrackingSessionService.getSession({ ...scope, sessionId: 'atse_a' })
        )
      ).code
    ).toBe('agent_tracking_individuals_hidden');
    expect(callsTo('session:list')).toHaveLength(0);
    expect(callsTo('session:get')).toHaveLength(0);
  });

  it('rejects the filter values of every field', async () => {
    for (let field of ['member', 'model', 'client'] as const) {
      let error = await rejection(
        agentTrackingFilterValueService.listFilterValues({
          ...scope,
          field,
          range: { preset: 'last_7_days' }
        })
      );
      expect(error.code, field).toBe('agent_tracking_individuals_hidden');
    }

    expect(rpc.calls).toHaveLength(0);
  });
});
