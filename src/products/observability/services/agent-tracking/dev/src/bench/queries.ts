import type { AgentTrackingClient } from '@mtsrc/agent-tracking-api-internal';
import {
  breakdownQuery,
  filterFields,
  filterValuesLimit,
  timelineQuery
} from '@metorial/module-agent-tracking-query/src/lib/queries';
import {
  normalizeRange,
  queryRange,
  resolveRange
} from '@metorial/module-agent-tracking-query/src/lib/range';
import { dayMs } from '../lib/clock';

export let dashboardPageSize = 25;

type InputOf<Method extends (input: any, ...rest: any[]) => any> = Parameters<Method>[0];

type SessionListInput = InputOf<AgentTrackingClient['session']['list']>;

export type BenchCall =
  | { method: 'query.run'; input: InputOf<AgentTrackingClient['query']['run']> }
  | { method: 'query.values'; input: InputOf<AgentTrackingClient['query']['values']> }
  | { method: 'session.list'; input: SessionListInput };

export type BenchContext = {
  organizationId: string;
  instanceId: string;
  userIds: string[];
  modelIds: string[];
  now: Date;
};

type SessionPage = Awaited<ReturnType<AgentTrackingClient['session']['list']>>;

export type PrepareList = (input: SessionListInput) => Promise<SessionPage>;

export type NamedQuery = {
  name: string;
  source: string;
  budgetP95Ms?: number;
  build: (ctx: BenchContext, list: PrepareList) => Promise<BenchCall>;
};

// query.values runs its aggregation through queryService.run, so it takes the same
// per-organization slot and per-minute count as query.run.
export let takesQuerySlot = (call: BenchCall) =>
  call.method == 'query.run' || call.method == 'query.values';

let last30Days = (now: Date) =>
  resolveRange(normalizeRange({ preset: 'last_30_days', timeZone: 'UTC' }), now);

let lastDaysAligned = (now: Date, days: number) => {
  let today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  return {
    from: new Date(today - (days - 1) * dayMs).toISOString(),
    to: now.toISOString()
  };
};

let listBase = (ctx: BenchContext) => ({
  organizationId: ctx.organizationId,
  instanceIds: [ctx.instanceId],
  limit: dashboardPageSize
});

let lastItem = (page: SessionPage) => page.items[page.items.length - 1]?.sessionKey;

let firstItem = (page: SessionPage) => page.items[0]?.sessionKey;

let required = (value: string | undefined, what: string) => {
  if (!value) throw new Error(`No ${what} to page from; is the organization seeded?`);
  return value;
};

// The dashboard's reads, built by the Metorial-side query module itself, and the three budgeted
// queries of doc 11 §15.
export let namedQueries: NamedQuery[] = [
  {
    name: 'spend.timeline',
    source: 'dashboard Spend page: timelineQuery, last 30 days by day',
    build: async ctx => ({
      method: 'query.run',
      input: {
        organizationId: ctx.organizationId,
        scope: { instanceIds: [ctx.instanceId] },
        query: timelineQuery(last30Days(ctx.now))
      }
    })
  },
  {
    name: 'spend.breakdown.member',
    source: 'dashboard Spend page: breakdownQuery by member',
    build: async ctx => ({
      method: 'query.run',
      input: {
        organizationId: ctx.organizationId,
        scope: { instanceIds: [ctx.instanceId] },
        query: breakdownQuery({ range: last30Days(ctx.now), groupBy: 'member' })
      }
    })
  },
  {
    name: 'spend.breakdown.model',
    source: 'dashboard Spend page: breakdownQuery by model',
    build: async ctx => ({
      method: 'query.run',
      input: {
        organizationId: ctx.organizationId,
        scope: { instanceIds: [ctx.instanceId] },
        query: breakdownQuery({ range: last30Days(ctx.now), groupBy: 'model' })
      }
    })
  },
  ...(['member', 'model'] as const).map((field): NamedQuery => ({
    name: `filter.values.${field}`,
    source: `dashboard filter values: ${field}`,
    build: async ctx => ({
      method: 'query.values',
      input: {
        organizationId: ctx.organizationId,
        scope: { instanceIds: [ctx.instanceId] },
        dataset: 'usage',
        field: filterFields[field],
        range: queryRange(last30Days(ctx.now)),
        limit: filterValuesLimit
      }
    })
  })),
  {
    name: 'sessions.list',
    source: 'dashboard Sessions page, first page',
    build: async ctx => ({ method: 'session.list', input: listBase(ctx) })
  },
  {
    name: 'sessions.list.member',
    source: 'Sessions page filtered by one member',
    build: async ctx => ({
      method: 'session.list',
      input: { ...listBase(ctx), userIds: ctx.userIds.slice(0, 1) }
    })
  },
  {
    name: 'sessions.list.members3',
    source: 'Sessions page filtered by three members',
    build: async ctx => ({
      method: 'session.list',
      input: { ...listBase(ctx), userIds: [...ctx.userIds.slice(0, 3)].sort() }
    })
  },
  {
    name: 'sessions.list.model',
    source: 'Sessions page filtered by one model',
    build: async ctx => ({
      method: 'session.list',
      input: { ...listBase(ctx), modelIds: ctx.modelIds.slice(0, 1) }
    })
  },
  {
    name: 'sessions.list.next',
    source: 'Sessions page, next page (after the last item, as the dashboard passes it)',
    build: async (ctx, list) => ({
      method: 'session.list',
      input: {
        ...listBase(ctx),
        after: required(lastItem(await list(listBase(ctx))), 'first page')
      }
    })
  },
  {
    name: 'sessions.list.previous',
    source: 'Sessions page, back from the second page',
    build: async (ctx, list) => {
      let first = await list(listBase(ctx));
      let second = await list({
        ...listBase(ctx),
        after: required(lastItem(first), 'first page')
      });

      return {
        method: 'session.list',
        input: { ...listBase(ctx), before: required(firstItem(second), 'second page') }
      };
    }
  },
  {
    name: 'sessions.list.last',
    source: 'Sessions page, the oldest page',
    build: async (ctx, list) => {
      let oldest = await list({
        ...listBase(ctx),
        order: 'asc',
        limit: dashboardPageSize + 1
      });

      return {
        method: 'session.list',
        input: { ...listBase(ctx), after: required(lastItem(oldest), 'oldest page') }
      };
    }
  },
  {
    name: 'budget.usage.month.two_dimensions',
    source: 'doc 11 §15: a month of usage with two dimensions, p95 under 1 s',
    budgetP95Ms: 1_000,
    build: async ctx => ({
      method: 'query.run',
      input: {
        organizationId: ctx.organizationId,
        query: {
          atq: '0',
          dataset: 'usage',
          range: lastDaysAligned(ctx.now, 30),
          dimensions: ['user', 'model'],
          measures: ['cost.usd', 'tokens', 'requests'],
          labels: false
        }
      }
    })
  },
  {
    name: 'budget.usage.year.two_dimensions',
    source: 'doc 11 §15: a year of usage with two dimensions, p95 under 3 s',
    budgetP95Ms: 3_000,
    build: async ctx => ({
      method: 'query.run',
      input: {
        organizationId: ctx.organizationId,
        query: {
          atq: '0',
          dataset: 'usage',
          range: lastDaysAligned(ctx.now, 365),
          dimensions: ['user', 'model'],
          measures: ['cost.usd', 'tokens', 'requests'],
          labels: false
        }
      }
    })
  },
  {
    name: 'budget.requests.week',
    source: 'doc 11 §15: a week of requests, p95 under 2 s',
    budgetP95Ms: 2_000,
    build: async ctx => ({
      method: 'query.run',
      input: {
        organizationId: ctx.organizationId,
        query: {
          atq: '0',
          dataset: 'requests',
          range: lastDaysAligned(ctx.now, 7),
          dimensions: ['model'],
          measures: ['requests', 'requests.error_rate', 'latency', 'tokens'],
          labels: false
        }
      }
    })
  }
];

export let selectQueries = (names: string[] | undefined) => {
  if (!names?.length) return namedQueries;

  let unknown = names.filter(name => !namedQueries.some(query => query.name == name));
  if (unknown.length) throw new Error(`Unknown queries: ${unknown.join(', ')}`);

  return namedQueries.filter(query => names.includes(query.name));
};
