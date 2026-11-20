import { describe, expect, it } from 'vitest';
import { parseQuery } from '@mtsrc/agent-tracking-query-spec';
import { datasets } from '@mtsrc/agent-tracking-module-query';
import {
  namedQueries,
  selectQueries,
  type BenchCall,
  type BenchContext,
  takesQuerySlot,
  type PrepareList
} from '../../src/bench/queries';
import { dayMs } from '../../src/lib/clock';
import { createOrganizationPace } from '../../src/lib/pace';
import { createFakeClock } from '../fakeClock';

let ctx: BenchContext = {
  organizationId: 'ator_bench',
  instanceId: 'atin_bench',
  userIds: ['aten_c', 'aten_a', 'aten_b', 'aten_d'],
  modelIds: ['claude-sonnet-4-5', 'claude-haiku-4-5'],
  now: new Date('2026-11-18T12:00:00Z')
};

let pages: Parameters<PrepareList>[0][] = [];

let list: PrepareList = async input => {
  pages.push(input);
  let prefix = input.after
    ? `after-${input.after}`
    : input.order == 'asc'
      ? 'oldest'
      : 'first';

  return {
    items: Array.from({ length: input.limit ?? 25 }, (_, index) => ({
      sessionKey: `${prefix}-${index}`
    }))
  } as never;
};

let fieldName = (value: unknown) =>
  typeof value == 'string' ? value : (value as { field: string }).field;

let measureName = (value: unknown) => (typeof value == 'string' ? value : null);

describe('benchmark query set', () => {
  it('names the dashboard reads and the three budgeted queries', () => {
    let names = namedQueries.map(query => query.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'spend.timeline',
        'spend.breakdown.member',
        'spend.breakdown.model',
        'filter.values.member',
        'filter.values.model',
        'sessions.list',
        'sessions.list.member',
        'sessions.list.members3',
        'sessions.list.model',
        'sessions.list.next',
        'sessions.list.previous',
        'sessions.list.last'
      ])
    );
    expect(
      namedQueries
        .filter(query => query.budgetP95Ms)
        .map(query => [query.name, query.budgetP95Ms])
    ).toEqual([
      ['budget.usage.month.two_dimensions', 1_000],
      ['budget.usage.year.two_dimensions', 3_000],
      ['budget.requests.week', 2_000]
    ]);
  });

  it('builds query.run bodies the parser accepts, on fields the catalog has', async () => {
    for (let query of namedQueries) {
      let call: BenchCall = await query.build(ctx, list);
      if (call.method != 'query.run') continue;

      let parsed = parseQuery(call.input.query);
      expect(
        parsed.ok,
        `${query.name}: ${JSON.stringify(parsed.ok ? null : parsed.errors)}`
      ).toBe(true);

      let dataset = datasets[call.input.query.dataset as keyof typeof datasets];
      expect(dataset, query.name).toBeDefined();

      for (let dimension of (call.input.query.dimensions as unknown[] | undefined) ?? []) {
        expect(
          dataset.fields[fieldName(dimension)],
          `${query.name} ${fieldName(dimension)}`
        ).toBeDefined();
      }

      for (let measure of (call.input.query.measures as unknown[] | undefined) ?? []) {
        let name = measureName(measure);
        if (name) expect(dataset.metrics[name], `${query.name} ${name}`).toBeDefined();
      }
    }
  });

  it('keeps the budgeted ranges at a month, a year and a week', async () => {
    let span = async (name: string) => {
      let call = await selectQueries([name])[0]!.build(ctx, list);
      if (call.method != 'query.run') throw new Error('not a query');

      let range = call.input.query.range as { from: string; to: string };
      return (Date.parse(range.to) - Date.parse(range.from)) / dayMs;
    };

    expect(await span('budget.usage.month.two_dimensions')).toBe(29.5);
    expect(await span('budget.usage.year.two_dimensions')).toBe(364.5);
    expect(await span('budget.requests.week')).toBe(6.5);

    let call = await selectQueries(['budget.requests.week'])[0]!.build(ctx, list);
    if (call.method != 'query.run') throw new Error('not a query');
    expect((call.input.query.range as { from: string }).from).toBe('2026-11-12T00:00:00.000Z');
  });

  it('pages the session list the way the dashboard does', async () => {
    pages = [];
    let build = async (name: string) =>
      (await selectQueries([name])[0]!.build(ctx, list)) as Extract<
        BenchCall,
        { method: 'session.list' }
      >;

    expect((await build('sessions.list')).input).toEqual({
      organizationId: 'ator_bench',
      instanceIds: ['atin_bench'],
      limit: 25
    });
    expect((await build('sessions.list.members3')).input.userIds).toEqual([
      'aten_a',
      'aten_b',
      'aten_c'
    ]);
    expect((await build('sessions.list.model')).input.modelIds).toEqual(['claude-sonnet-4-5']);
    expect((await build('sessions.list.next')).input.after).toBe('first-24');
    expect((await build('sessions.list.previous')).input.before).toBe('after-first-24-0');
    expect((await build('sessions.list.last')).input.after).toBe('oldest-25');
    expect(pages.some(page => page.order == 'asc' && page.limit == 26)).toBe(true);
  });

  it('takes a query slot for query.run and query.values only', async () => {
    let kinds = Object.fromEntries(
      await Promise.all(
        namedQueries.map(async query => [
          query.name,
          takesQuerySlot(await query.build(ctx, list))
        ])
      )
    );

    expect(kinds['filter.values.member']).toBe(true);
    expect(kinds['spend.timeline']).toBe(true);
    expect(kinds['sessions.list']).toBe(false);
  });

  it('rejects unknown names', () => {
    expect(() => selectQueries(['nope'])).toThrow(/nope/);
    expect(selectQueries(undefined)).toBe(namedQueries);
  });
});

describe('organization pacing', () => {
  it('holds each organization under its per-minute limit', async () => {
    let clock = createFakeClock(0);
    let pace = createOrganizationPace(3, clock);

    await pace.wait('a');
    await pace.wait('a');
    await pace.wait('b');
    await pace.wait('a');
    expect(clock.now()).toBe(0);

    await pace.wait('a');
    expect(clock.now()).toBe(60_000);

    await pace.wait('b');
    expect(clock.now()).toBe(60_000);
  });
});
