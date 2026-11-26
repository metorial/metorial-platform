import {
  agentTrackingClientFamilies,
  fromServiceFamily,
  toServiceFamily
} from '@metorial/module-agent-tracking-sync';
import { unknownMemberKey } from './members';
import { invalidInputError } from './errors';
import { dayMs, queryRange, type ResolvedRange } from './range';
import type {
  AgentTrackingSpendFilters,
  BreakdownGroup,
  FilterField,
  SpendGroup,
  SpendReportGroup
} from './types';

let breakdownLimit = 10;

export let reportBreakdownLimits = {
  model: 50,
  client: 50,
  member: 1000
} satisfies Record<SpendReportGroup, number>;

let unknownModelNamesLimit = 10;

export let filterValuesLimit = 100;

export let evidenceWindowDays = 30;

export let memberWindowDays = 400;

export let maxMembers = 1000;

export let maxInsightMembers = 2000;

export let requestRecordDays = 90;

let engineMaxLimit = 10_000;

export let maxDistinctCount = 10_000;

export let agentActiveWindowDays = 30;

export let agentActivityLookbackDays = 60;

let sessionModelsLimit = 50;

export let sessionCountColumn = 'sessions_active';

export let memberCountColumn = 'members_active';

export let sessionsWithCostColumn = 'sessions_with_cost';

export let sessionsWithListPriceColumn = 'sessions_with_list_price';

export let distinctCappedWarning = 'distinct_capped';

export let retentionClippedWarning = 'retention_clipped';

export let breakdownGroups = {
  member: 'user',
  model: 'model',
  repository: 'repo',
  branch: 'branch',
  ticket: 'ticket'
} as const satisfies Record<BreakdownGroup, string>;

export let filterFields = {
  member: 'user',
  model: 'model',
  client: 'client.family',
  seat: 'billing.seat',
  repository: 'repo',
  branch: 'branch',
  ticket: 'ticket'
} as const satisfies Record<FilterField, string>;

export let reportBreakdownGroups = {
  member: breakdownGroups.member,
  model: breakdownGroups.model,
  client: filterFields.client
} as const satisfies Record<SpendReportGroup, string>;

export let spendGroupColumns = {
  ...breakdownGroups,
  ...reportBreakdownGroups
} as const satisfies Record<SpendGroup, string>;

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
  'tokens',
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

// The engine rejects a raw-record range longer than its limit, measured exactly.
export let assertRecordRange = (range: { from: Date; to: Date }, subject: string) => {
  if (range.to.getTime() - range.from.getTime() > requestRecordDays * dayMs) {
    throw invalidInputError(
      `${subject} come from individual records, which are kept for ${requestRecordDays} days. Choose a range of at most ${requestRecordDays} days.`
    );
  }
};

let sortedUnique = (values: string[] | undefined) =>
  values?.length ? [...new Set(values)].sort() : undefined;

export let normalizeSpendFilters = (
  filters: AgentTrackingSpendFilters | undefined
): AgentTrackingSpendFilters => ({
  clientFamilies: sortedUnique(filters?.clientFamilies?.map(fromServiceFamily)),
  modelIds: sortedUnique(filters?.modelIds),
  memberIds: sortedUnique(filters?.memberIds)
});

let idWhere = (field: string, ids: string[]): Filter => {
  let known = ids.filter(id => id != unknownMemberKey);
  let knownWhere = { field, op: 'in', value: known };
  if (!ids.includes(unknownMemberKey)) return knownWhere;

  let unknownWhere = { field, op: 'isNull' };
  return known.length ? { or: [knownWhere, unknownWhere] } : unknownWhere;
};

let spendWhere = (filters: AgentTrackingSpendFilters): Filter | undefined => {
  let clauses: Filter[] = [];
  if (filters.clientFamilies) {
    let families = [...new Set(filters.clientFamilies.map(toServiceFamily))];
    clauses.push({ field: 'client.family', op: 'in', value: families });
  }
  if (filters.modelIds) clauses.push(idWhere('model', filters.modelIds));
  if (filters.memberIds) clauses.push(idWhere('user', filters.memberIds));

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
  filters: AgentTrackingSpendFilters = {},
  interval: 'day' | 'month' = 'day'
) => ({
  ...usageQuery(range, spendWhere(filters)),
  dimensions: [`time.${interval}`],
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
  groupBy: SpendGroup;
  filters?: AgentTrackingSpendFilters;
  limit?: number;
}) => ({
  ...usageQuery(d.range, spendWhere(d.filters ?? {})),
  dimensions: [spendGroupColumns[d.groupBy]],
  measures: spendMeasures,
  orderBy: [{ by: 'cost.usd', direction: 'desc' }],
  limit: d.limit ?? breakdownLimit,
  other: true,
  totals: true,
  labels: true
});

export let unknownModelsQuery = (
  range: ResolvedRange,
  filters: AgentTrackingSpendFilters = {}
) => {
  let unknownModel = { field: 'model', op: 'isNull' };
  let otherFilters = spendWhere({
    clientFamilies: filters.clientFamilies,
    memberIds: filters.memberIds
  });

  return {
    ...usageQuery(range, otherFilters ? { and: [unknownModel, otherFilters] } : unknownModel),
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

export let insightColumns = {
  unattributedCost: 'cost_unattributed',
  modelsCost: 'models_cost',
  modelsRequests: 'models_requests',
  outdatedCost: 'cost_outdated',
  cacheHitRate: 'cache.hit_rate',
  highEffort: 'requests_high_effort',
  maxEffort: 'requests_max_effort',
  withEffort: 'requests_with_effort',
  fast: 'requests_fast',
  withSpeed: 'requests_with_speed'
} as const;

export let outdatedModelStatuses = ['deprecated', 'retired'];

// A model without a family maps to isLatest false, so only a model in a family can be behind.
let outdatedModelWhere = {
  or: [
    { field: 'model.status', op: 'in', value: outdatedModelStatuses },
    {
      and: [
        { field: 'model.isLatest', op: 'eq', value: false },
        { field: 'model.family', op: 'notNull' }
      ]
    }
  ]
};

let costWhere = (where: Filter, as: string) => ({
  fn: 'sum',
  field: 'cost.usd',
  where,
  as
});

let countWhere = (where: Filter, as: string) => ({ fn: 'count', where, as });

export let memberInsightsUsageQuery = (d: {
  range: ResolvedRange;
  modelIds?: string[];
  practices: boolean;
}) => ({
  ...usageQuery(d.range, undefined),
  dimensions: ['user'],
  measures: [
    ...spendMeasures,
    ...activityMeasures,
    costWhere({ field: 'user', op: 'isNull' }, insightColumns.unattributedCost),
    ...(d.modelIds
      ? [
          costWhere(idWhere('model', d.modelIds), insightColumns.modelsCost),
          {
            fn: 'sum',
            field: 'requests',
            where: idWhere('model', d.modelIds),
            as: insightColumns.modelsRequests
          }
        ]
      : []),
    ...(d.practices
      ? [
          costWhere(outdatedModelWhere, insightColumns.outdatedCost),
          insightColumns.cacheHitRate
        ]
      : [])
  ],
  orderBy: [
    ...(d.modelIds
      ? [
          { by: insightColumns.modelsCost, direction: 'desc' },
          { by: insightColumns.modelsRequests, direction: 'desc' }
        ]
      : []),
    { by: 'cost.usd', direction: 'desc' }
  ],
  limit: maxInsightMembers,
  totals: true,
  labels: false
});

export let memberInsightsRequestsQuery = (d: {
  range: ResolvedRange;
  practices: boolean;
  seat: boolean;
}) => ({
  atq: '0',
  dataset: 'requests',
  range: queryRange(d.range),
  timeZone: d.range.timeZone,
  dimensions: ['user', ...(d.seat ? [filterFields.seat, 'billing.plan'] : [])],
  measures: [
    'requests',
    ...(d.practices
      ? [
          countWhere(
            { field: 'reasoning.effort', op: 'eq', value: 'high' },
            insightColumns.highEffort
          ),
          countWhere(
            { field: 'reasoning.effort', op: 'eq', value: 'max' },
            insightColumns.maxEffort
          ),
          countWhere({ field: 'reasoning.effort', op: 'notNull' }, insightColumns.withEffort),
          countWhere({ field: 'speed', op: 'eq', value: 'fast' }, insightColumns.fast),
          countWhere({ field: 'speed', op: 'notNull' }, insightColumns.withSpeed)
        ]
      : [])
  ],
  orderBy: [{ by: 'requests', direction: 'desc' }],
  limit: engineMaxLimit,
  totals: true,
  labels: false
});

export let outdatedModelsQuery = (range: ResolvedRange) => ({
  ...usageQuery(range, outdatedModelWhere),
  dimensions: [
    { field: 'user', missing: 'exclude' },
    'model',
    'model.status',
    'model.isLatest'
  ],
  measures: ['cost.usd'],
  orderBy: [{ by: 'cost.usd', direction: 'desc' }],
  limit: engineMaxLimit,
  labels: false
});

export let lastActivityQuery = (now: Date) => ({
  atq: '0',
  dataset: 'sessions',
  range: queryRange({ from: new Date(now.getTime() - memberWindowDays * dayMs), to: now }),
  dimensions: [{ field: 'user', missing: 'exclude' }],
  measures: ['last_activity'],
  orderBy: [{ by: 'last_activity', direction: 'desc' }],
  limit: engineMaxLimit,
  labels: false
});
