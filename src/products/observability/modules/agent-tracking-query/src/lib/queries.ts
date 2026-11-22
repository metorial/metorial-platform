import {
  agentTrackingClientFamilies,
  fromServiceFamily,
  toServiceFamily
} from '@metorial/module-agent-tracking-sync';
import { unknownMemberKey } from './members';
import { queryRange, type ResolvedRange } from './range';
import type { AgentTrackingSpendFilters, BreakdownGroup, FilterField } from './types';

let breakdownLimit = 10;

let unknownModelNamesLimit = 10;

export let filterValuesLimit = 100;

export let evidenceWindowDays = 30;

export let memberWindowDays = 400;

export let maxMembers = 1000;

export let agentActiveWindowDays = 30;

export let agentActivityLookbackDays = 60;

let sessionModelsLimit = 50;

export let sessionCountColumn = 'sessions_active';

export let memberCountColumn = 'members_active';

export let sessionsWithCostColumn = 'sessions_with_cost';

export let sessionsWithListPriceColumn = 'sessions_with_list_price';

export let distinctCappedWarning = 'distinct_capped';

export let retentionClippedWarning = 'retention_clipped';

export let breakdownGroups = { member: 'user', model: 'model' } as const satisfies Record<
  BreakdownGroup,
  string
>;

export let filterFields = {
  member: 'user',
  model: 'model',
  client: 'client.family'
} as const satisfies Record<FilterField, string>;

export let breakdownGroupKeys = Object.keys(breakdownGroups) as BreakdownGroup[];

export let filterFieldKeys = Object.keys(filterFields) as FilterField[];

export let spendMeasures = [
  'cost.usd',
  'cost.list',
  'cost.reported',
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

// A slice that only marks a session start does not count. Total tokens is not stored, so its
// parts are tested; cost both ways, because a credit is negative.
export let withUsage = {
  or: [
    { field: 'requests', op: 'gt', value: 0 },
    ...['input', 'cacheRead', 'cacheWrite', 'output', 'reasoning'].map(part => ({
      field: `tokens.${part}`,
      op: 'gt',
      value: 0
    })),
    { field: 'cost.usd', op: 'gt', value: 0 },
    { field: 'cost.usd', op: 'lt', value: 0 }
  ]
};

export let activityMeasures = [
  { fn: 'countDistinct', field: 'session', where: withUsage, as: sessionCountColumn },
  { fn: 'countDistinct', field: 'user', where: withUsage, as: memberCountColumn }
];

type Filter = Record<string, unknown>;

let allOf = (clauses: Filter[]) => (clauses.length > 1 ? { and: clauses } : clauses[0]);

let sortedUnique = (values: string[] | undefined) =>
  values?.length ? [...new Set(values)].sort() : undefined;

export let normalizeSpendFilters = (
  filters: AgentTrackingSpendFilters | undefined
): AgentTrackingSpendFilters => ({
  clientFamilies: sortedUnique(filters?.clientFamilies?.map(fromServiceFamily)),
  modelIds: sortedUnique(filters?.modelIds)
});

let modelWhere = (modelIds: string[]): Filter => {
  let known = modelIds.filter(id => id != unknownMemberKey);
  let knownWhere = { field: 'model', op: 'in', value: known };
  if (!modelIds.includes(unknownMemberKey)) return knownWhere;

  let unknownWhere = { field: 'model', op: 'isNull' };
  return known.length ? { or: [knownWhere, unknownWhere] } : unknownWhere;
};

let spendWhere = (filters: AgentTrackingSpendFilters): Filter | undefined => {
  let clauses: Filter[] = [];
  if (filters.clientFamilies) {
    let families = [...new Set(filters.clientFamilies.map(toServiceFamily))];
    clauses.push({ field: 'client.family', op: 'in', value: families });
  }
  if (filters.modelIds) clauses.push(modelWhere(filters.modelIds));

  return allOf(clauses);
};

let usageQuery = (
  range: Pick<ResolvedRange, 'from' | 'to' | 'timeZone'>,
  where: Filter | undefined
) => ({
  atq: '0',
  dataset: 'usage',
  range: queryRange(range),
  timeZone: range.timeZone,
  ...(where ? { where } : {})
});

export let timelineQuery = (
  range: ResolvedRange,
  filters: AgentTrackingSpendFilters = {}
) => ({
  ...usageQuery(range, spendWhere(filters)),
  dimensions: ['time.day'],
  measures: [...spendMeasures, ...activityMeasures],
  fill: { time: 'zero' },
  totals: true,
  labels: false
});

export let periodTotalQuery = (
  range: { from: Date; to: Date; timeZone: string },
  filters: AgentTrackingSpendFilters = {}
) => ({
  ...usageQuery(range, spendWhere(filters)),
  measures: [...spendMeasures, ...activityMeasures],
  totals: true,
  labels: false
});

export let sessionModelsQuery = (d: {
  sessionKey: string;
  range: { from: Date; to: Date };
}) => ({
  atq: '0',
  dataset: 'usage',
  range: queryRange(d.range),
  where: { field: 'session', op: 'eq', value: d.sessionKey },
  dimensions: ['model'],
  measures: spendMeasures,
  derived: [{ as: 'share', expr: { shareOfTotal: 'cost.usd' }, format: 'percent' }],
  orderBy: [{ by: 'cost.usd', direction: 'desc' }],
  limit: sessionModelsLimit,
  totals: true,
  labels: true
});

export let breakdownQuery = (d: {
  range: ResolvedRange;
  groupBy: BreakdownGroup;
  filters?: AgentTrackingSpendFilters;
}) => ({
  ...usageQuery(d.range, spendWhere(d.filters ?? {})),
  dimensions: [breakdownGroups[d.groupBy]],
  measures: spendMeasures,
  derived: [{ as: 'share', expr: { shareOfTotal: 'cost.usd' }, format: 'percent' }],
  orderBy: [{ by: 'cost.usd', direction: 'desc' }],
  limit: breakdownLimit,
  other: true,
  totals: true,
  labels: true
});

export let unknownModelsQuery = (
  range: ResolvedRange,
  filters: AgentTrackingSpendFilters = {}
) => {
  let unknownModel = { field: 'model', op: 'isNull' };
  let clientWhere = spendWhere({ clientFamilies: filters.clientFamilies });

  return {
    ...usageQuery(range, clientWhere ? { and: [unknownModel, clientWhere] } : unknownModel),
    dimensions: [{ field: 'model.raw', missing: 'exclude' }],
    measures: ['requests'],
    orderBy: [{ by: 'requests', direction: 'desc' }],
    limit: unknownModelNamesLimit,
    labels: false
  };
};

export let setupClientFamily = agentTrackingClientFamilies.claude_code.serviceFamily;

let setupClient = { field: 'client.family', op: 'eq', value: setupClientFamily };

export let setupSessionsQuery = (range: { from: Date; to: Date }) => ({
  atq: '0',
  dataset: 'sessions',
  range: queryRange(range),
  where: setupClient,
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

// Tool details arrive only with OTEL_LOG_TOOL_DETAILS=1. Hook events carry the input too, so
// only OpenTelemetry log calls count.
export let toolDetailsQuery = (range: { from: Date; to: Date }) => ({
  atq: '0',
  dataset: 'tool_calls',
  range: queryRange(range),
  where: {
    and: [
      setupClient,
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

// The sessions dataset is ranged by start, so the window reaches further back than the activity
// filter to catch long sessions that are still active.
export let agentActivityQuery = (d: {
  window: { from: Date; to: Date };
  activeSince: Date;
  agentKeys: string[];
  byMember: boolean;
}) => ({
  atq: '0',
  dataset: 'sessions',
  range: queryRange(d.window),
  where: {
    and: [
      { field: 'lastActivityAt', op: 'gte', value: d.activeSince.toISOString() },
      { field: 'agent', op: 'in', value: d.agentKeys }
    ]
  },
  dimensions: [
    { field: 'agent', missing: 'exclude' },
    ...(d.byMember ? [{ field: 'user', missing: 'exclude' }] : [])
  ],
  measures: ['last_activity'],
  orderBy: [{ by: 'last_activity', direction: 'desc' }],
  limit: maxMembers,
  labels: false
});

export let membersQuery = (d: {
  window: { from: Date; to: Date };
  lastActivity?: { from: Date; to: Date };
  memberIds?: string[];
}) => {
  let clauses: Filter[] = [
    ...(d.lastActivity
      ? [
          { field: 'lastActivityAt', op: 'gte', value: d.lastActivity.from.toISOString() },
          { field: 'lastActivityAt', op: 'lt', value: d.lastActivity.to.toISOString() }
        ]
      : []),
    ...(d.memberIds ? [{ field: 'user', op: 'in', value: d.memberIds }] : [])
  ];

  return {
    atq: '0',
    dataset: 'sessions',
    range: queryRange(d.window),
    ...(clauses.length ? { where: allOf(clauses) } : {}),
    dimensions: [{ field: 'user', missing: 'exclude' }],
    measures: [
      'sessions',
      'last_activity',
      'cost.usd',
      'cost.list',
      'cost.reported',
      { fn: 'count', where: { field: 'cost.usd', op: 'notNull' }, as: sessionsWithCostColumn },
      {
        fn: 'count',
        where: { field: 'cost.list', op: 'notNull' },
        as: sessionsWithListPriceColumn
      }
    ],
    orderBy: [{ by: 'last_activity', direction: 'desc' }],
    limit: maxMembers,
    labels: false
  };
};
