import { invalidInputError } from './errors';
import { countOf, estimateOf, microsOf } from './money';
import {
  distinctCappedWarning,
  insightColumns,
  maxInsightMembers,
  memberCountColumn,
  requestRecordDays,
  sessionCountColumn
} from './queries';
import { dayMs, type ResolvedRange } from './range';
import { warned, type UsageResult } from './scope';
import { spendFiguresOf, type Cells } from './spend';
import type {
  AgentTrackingMemberInsightFigures,
  AgentTrackingMemberInsightsSummary,
  AgentTrackingModelUsageFigures,
  AgentTrackingPracticeFigures,
  AgentTrackingSpendCost,
  MemberInsightsFlag,
  MemberInsightsGroup,
  MemberInsightsSort,
  MemberInsightsThresholds
} from './types';

let maxOutdatedModels = 3;

let clippedToleranceMs = 60 * 1000;

let cacheHitRateDigits = 6;

export let memberInsightsGroups = [
  'models',
  'practices',
  'seat'
] as const satisfies readonly MemberInsightsGroup[];

export let memberInsightsSorts = [
  'cost',
  'sessions',
  'requests',
  'last_activity',
  'model_share',
  'model_cost',
  'high_effort_share',
  'fast_share',
  'outdated_share',
  'cache_hit_rate',
  'seat_usage'
] as const satisfies readonly MemberInsightsSort[];

export let memberInsightsFlags = [
  'model_share',
  'high_effort',
  'fast_mode',
  'outdated_models',
  'low_cache_hit_rate',
  'low_usage_seat'
] as const satisfies readonly MemberInsightsFlag[];

let sortGroups = {
  cost: null,
  sessions: null,
  requests: null,
  last_activity: null,
  model_share: 'models',
  model_cost: 'models',
  high_effort_share: 'practices',
  fast_share: 'practices',
  outdated_share: 'practices',
  cache_hit_rate: 'practices',
  seat_usage: 'seat'
} satisfies Record<MemberInsightsSort, MemberInsightsGroup | null>;

let thresholdParams: Record<
  keyof MemberInsightsThresholds,
  { name: string; group: MemberInsightsGroup; flag: MemberInsightsFlag }
> = {
  modelShareMin: { name: 'model_share_min', group: 'models', flag: 'model_share' },
  highEffortShareMin: {
    name: 'high_effort_share_min',
    group: 'practices',
    flag: 'high_effort'
  },
  fastShareMin: { name: 'fast_share_min', group: 'practices', flag: 'fast_mode' },
  outdatedShareMin: {
    name: 'outdated_share_min',
    group: 'practices',
    flag: 'outdated_models'
  },
  cacheHitRateMax: {
    name: 'cache_hit_rate_max',
    group: 'practices',
    flag: 'low_cache_hit_rate'
  },
  seatUsageMaxMicros: {
    name: 'seat_usage_max_micros',
    group: 'seat',
    flag: 'low_usage_seat'
  }
};

type CompactCost = [
  totalMicros: number | null,
  billedMicros: number | null,
  reportedByClientMicros: number | null,
  listPriceMicros: number | null,
  requestsWithoutCost: number,
  requestsWithoutListPrice: number
];

type CompactPractices = [
  outdatedCostMicros: number | null,
  cacheHitRate: number | null,
  requestsMeasured: number,
  requestsWithEffort: number,
  highEffortRequests: number,
  maxEffortRequests: number,
  requestsWithSpeed: number,
  fastRequests: number,
  outdatedModels: [model: number, costMicros: number | null][]
];

type CompactRow = [
  id: string,
  cost: CompactCost,
  requests: number,
  sessions: number,
  lastActivityAt: number | null,
  models: [costMicros: number | null, requests: number] | null,
  practices: CompactPractices | null,
  seat: [seat: number | null, plan: number | null] | null
];

type MemberInsightsData = {
  range: ResolvedRange;
  rows: CompactRow[];
  strings: string[];
  models: Record<string, [status: string | null, isLatest: boolean | null]>;
  summary: Omit<AgentTrackingMemberInsightsSummary, 'members' | 'flagCounts' | 'seat'>;
  truncated: boolean;
};

type MemberInsightRow = Omit<
  AgentTrackingMemberInsightFigures,
  'rank' | 'flags' | 'lastActivityAt'
> & { lastActivityAt: number | null };

type RequestCounts = {
  requests: number;
  highEffort: number;
  maxEffort: number;
  withEffort: number;
  fast: number;
  withSpeed: number;
  seats: Map<string, { seat: string; plan: string | null; requests: number }>;
  plans: Map<string, number>;
};

let ratio = (part: number, whole: number) => (whole > 0 ? part / whole : null);

let microsShare = (part: number | null, whole: number | null) =>
  part === null || whole === null || whole <= 0 ? null : part / whole;

let finiteOrNull = (value: unknown) =>
  typeof value == 'number' && Number.isFinite(value) ? value : null;

let textOrNull = (value: unknown) => (typeof value == 'string' && value ? value : null);

// Mapped dimensions such as model.isLatest come back as the strings 'true' and 'false'.
let booleanOrNull = (value: unknown) =>
  value === true || value === 'true'
    ? true
    : value === false || value === 'false'
      ? false
      : null;

let byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

let textAt = (strings: string[], index: number | null) =>
  index === null ? null : (strings[index] ?? null);

export let normalizeInclude = (include: MemberInsightsGroup[] | undefined) =>
  memberInsightsGroups.filter(group => include?.includes(group));

export let assertInsightsInput = (d: {
  include: MemberInsightsGroup[];
  sort: MemberInsightsSort;
  thresholds: MemberInsightsThresholds;
  modelIds: string[] | undefined;
  seats: string[] | undefined;
}) => {
  let has = (group: MemberInsightsGroup) => d.include.includes(group);

  let sortGroup = sortGroups[d.sort];
  if (sortGroup && !has(sortGroup)) {
    throw invalidInputError(`sort=${d.sort} needs include=${sortGroup}.`);
  }

  if (has('models') && !d.modelIds?.length) {
    throw invalidInputError('include=models needs model_id: the models to measure.');
  }
  if (d.modelIds && !has('models')) throw invalidInputError('model_id needs include=models.');
  if (d.seats && !has('seat')) throw invalidInputError('seat needs include=seat.');

  for (let [key, param] of Object.entries(thresholdParams)) {
    if (d.thresholds[key as keyof MemberInsightsThresholds] === undefined) continue;

    if (!has(param.group)) {
      throw invalidInputError(`${param.name} needs include=${param.group}.`);
    }
  }
};

export let requestRecordsClipped = (range: { from: Date }, now: Date) =>
  range.from.getTime() < now.getTime() - requestRecordDays * dayMs - clippedToleranceMs;

let emptyCounts = (): RequestCounts => ({
  requests: 0,
  highEffort: 0,
  maxEffort: 0,
  withEffort: 0,
  fast: 0,
  withSpeed: 0,
  seats: new Map(),
  plans: new Map()
});

let countsOf = (cells: Cells | null | undefined): RequestCounts => ({
  ...emptyCounts(),
  requests: countOf(cells?.requests),
  highEffort: countOf(cells?.[insightColumns.highEffort]),
  maxEffort: countOf(cells?.[insightColumns.maxEffort]),
  withEffort: countOf(cells?.[insightColumns.withEffort]),
  fast: countOf(cells?.[insightColumns.fast]),
  withSpeed: countOf(cells?.[insightColumns.withSpeed])
});

let requestCountsByMember = (result: UsageResult | null) => {
  let byMember = new Map<string, RequestCounts>();

  for (let row of result?.rows ?? []) {
    if (typeof row.user != 'string') continue;

    let counts = byMember.get(row.user) ?? emptyCounts();
    let add = countsOf(row);
    counts.requests += add.requests;
    counts.highEffort += add.highEffort;
    counts.maxEffort += add.maxEffort;
    counts.withEffort += add.withEffort;
    counts.fast += add.fast;
    counts.withSpeed += add.withSpeed;

    let seat = textOrNull(row['billing.seat']);
    let plan = textOrNull(row['billing.plan']);
    if (seat) {
      let key = JSON.stringify([seat, plan]);
      let pair = counts.seats.get(key) ?? { seat, plan, requests: 0 };
      pair.requests += add.requests;
      counts.seats.set(key, pair);
    } else if (plan) {
      counts.plans.set(plan, (counts.plans.get(plan) ?? 0) + add.requests);
    }

    byMember.set(row.user, counts);
  }

  return byMember;
};

let seatOf = (counts: RequestCounts): [string | null, string | null] => {
  let [pair] = [...counts.seats.values()].sort(
    (a, b) =>
      b.requests - a.requests || byText(a.seat, b.seat) || byText(a.plan ?? '', b.plan ?? '')
  );
  if (pair) return [pair.seat, pair.plan];

  let [plan] = [...counts.plans.entries()].sort(
    ([a, countA], [b, countB]) => countB - countA || byText(a, b)
  );
  return [null, plan?.[0] ?? null];
};

let compactCost = (cost: AgentTrackingSpendCost): CompactCost => [
  cost.totalMicros,
  cost.billedMicros,
  cost.reportedByClientMicros,
  cost.listPriceMicros,
  cost.requestsWithoutCost,
  cost.requestsWithoutListPrice
];

let costOfCompact = (cost: CompactCost): AgentTrackingSpendCost => {
  let [totalMicros, billedMicros, reportedByClientMicros, listPriceMicros] = cost;

  return {
    totalMicros,
    billedMicros,
    ...estimateOf(totalMicros, billedMicros),
    reportedByClientMicros,
    listPriceMicros,
    requestsWithoutCost: cost[4],
    requestsWithoutListPrice: cost[5]
  };
};

let compactPractices = (d: {
  usage: Cells;
  counts: RequestCounts;
  cost: AgentTrackingSpendCost;
  requests: number;
  outdatedModels: [number, number | null][];
}): CompactPractices => {
  let priced = d.cost.totalMicros !== null;
  let idle = d.requests == 0 && !d.cost.totalMicros;
  let costPart = (column: string) => (priced ? (microsOf(d.usage[column]) ?? 0) : null);
  let cacheHitRate = idle ? null : finiteOrNull(d.usage[insightColumns.cacheHitRate]);

  return [
    costPart(insightColumns.outdatedCost),
    cacheHitRate === null ? null : Number(cacheHitRate.toFixed(cacheHitRateDigits)),
    d.counts.requests,
    d.counts.withEffort,
    d.counts.highEffort,
    d.counts.maxEffort,
    d.counts.withSpeed,
    d.counts.fast,
    d.outdatedModels
  ];
};

let practicesOf = (
  practices: CompactPractices,
  totalMicros: number | null
): AgentTrackingPracticeFigures => {
  let [outdated, cacheHitRate, measured, withEffort, high, max, withSpeed, fast] = practices;

  return {
    requestsMeasured: measured,
    requestsWithEffort: withEffort,
    highEffortRequests: high,
    maxEffortRequests: max,
    highEffortShare: ratio(high + max, withEffort),
    fastRequests: fast,
    fastShare: ratio(fast, withSpeed),
    outdatedCostMicros: outdated,
    outdatedShare: microsShare(outdated, totalMicros),
    cacheHitRate
  };
};

let compactModels = (d: {
  usage: Cells;
  cost: AgentTrackingSpendCost;
}): [number | null, number] => [
  d.cost.totalMicros === null ? null : (microsOf(d.usage[insightColumns.modelsCost]) ?? 0),
  countOf(d.usage[insightColumns.modelsRequests])
];

let modelsOf = (
  models: [number | null, number],
  totalMicros: number | null,
  requests: number
): AgentTrackingModelUsageFigures => ({
  costMicros: models[0],
  requests: models[1],
  costShare: microsShare(models[0], totalMicros),
  requestShare: ratio(models[1], requests)
});

let interner = () => {
  let strings: string[] = [];
  let indexes = new Map<string, number>();

  let intern = (value: string | null) => {
    if (value === null) return null;

    let index = indexes.get(value);
    if (index === undefined) {
      index = strings.push(value) - 1;
      indexes.set(value, index);
    }

    return index;
  };

  return { strings, intern };
};

let outdatedModelsOf = (
  result: UsageResult | null,
  intern: (value: string) => number | null
) => {
  let byMember = new Map<string, [number, number | null][]>();
  let models: MemberInsightsData['models'] = {};

  for (let row of result?.rows ?? []) {
    if (typeof row.user != 'string' || typeof row.model != 'string') continue;

    let list = byMember.get(row.user) ?? [];
    if (list.length >= maxOutdatedModels) continue;

    list.push([intern(row.model)!, microsOf(row['cost.usd'])]);
    byMember.set(row.user, list);
    models[row.model] = [
      textOrNull(row['model.status']),
      booleanOrNull(row['model.isLatest'])
    ];
  }

  return { byMember, models };
};

let usedSelectedModels = ([, , , , , models]: CompactRow) =>
  !!models && (models[1] > 0 || !!models[0]);

let lastActivityByMember = (result: UsageResult) =>
  new Map(
    result.rows.flatMap(row =>
      typeof row.user == 'string' && typeof row.last_activity == 'string'
        ? [[row.user, Date.parse(row.last_activity)] as const]
        : []
    )
  );

export let buildMemberInsights = (d: {
  range: ResolvedRange;
  now: Date;
  include: MemberInsightsGroup[];
  usage: UsageResult;
  lastActivity: UsageResult;
  requests: UsageResult | null;
  outdated: UsageResult | null;
  inactive: { ids: string[]; capped: boolean } | null;
}): MemberInsightsData => {
  let has = (group: MemberInsightsGroup) => d.include.includes(group);
  let totals = d.usage.totals ?? {};
  let total = spendFiguresOf(totals);
  let counts = requestCountsByMember(d.requests);
  let { strings, intern } = interner();
  let outdated = outdatedModelsOf(d.outdated, intern);
  let lastActivity = lastActivityByMember(d.lastActivity);

  let rowOf = (id: string, usage: Cells): CompactRow => {
    let figures = spendFiguresOf(usage);
    let memberCounts = counts.get(id) ?? emptyCounts();

    return [
      id,
      compactCost(figures.cost),
      figures.requests,
      countOf(usage[sessionCountColumn]),
      lastActivity.get(id) ?? null,
      has('models') ? compactModels({ usage, cost: figures.cost }) : null,
      has('practices')
        ? compactPractices({
            usage,
            counts: memberCounts,
            cost: figures.cost,
            requests: figures.requests,
            outdatedModels: outdated.byMember.get(id) ?? []
          })
        : null,
      has('seat') ? (seatOf(memberCounts).map(intern) as [number | null, number | null]) : null
    ];
  };

  let rows = d.usage.rows.flatMap(usage =>
    typeof usage.user == 'string' ? [rowOf(usage.user, usage)] : []
  );
  if (has('models')) rows = rows.filter(usedSelectedModels);

  let inactiveCut = false;
  if (d.inactive) {
    let active = new Set(rows.map(row => row[0]));
    let candidates = [...new Set([...lastActivity.keys(), ...d.inactive.ids])].filter(
      id => !active.has(id)
    );
    let room = Math.max(0, maxInsightMembers - rows.length);

    rows.push(...candidates.slice(0, room).map(id => rowOf(id, {})));
    inactiveCut = candidates.length > room || d.inactive.capped;
  }

  return {
    range: d.range,
    rows,
    strings,
    models: outdated.models,
    truncated:
      inactiveCut ||
      [d.usage, d.lastActivity, d.requests, d.outdated].some(
        result => !!result?.meta?.truncated
      ),
    summary: {
      cost: total.cost,
      requests: total.requests,
      sessions: countOf(totals[sessionCountColumn]),
      activeMembers: countOf(totals[memberCountColumn]),
      countsCapped: warned(d.usage, distinctCappedWarning),
      unattributedCostMicros:
        total.cost.totalMicros === null
          ? null
          : (microsOf(totals[insightColumns.unattributedCost]) ?? 0),
      models: has('models')
        ? modelsOf(
            compactModels({ usage: totals, cost: total.cost }),
            total.cost.totalMicros,
            total.requests
          )
        : null,
      practices: has('practices')
        ? practicesOf(
            compactPractices({
              usage: totals,
              counts: countsOf(d.requests?.totals),
              cost: total.cost,
              requests: total.requests,
              outdatedModels: []
            }),
            total.cost.totalMicros
          )
        : null,
      requestRecordsClipped:
        (has('practices') || has('seat')) && requestRecordsClipped(d.range, d.now)
    }
  };
};

export let expandMemberInsights = (data: MemberInsightsData): MemberInsightRow[] => {
  let totalMicros = data.summary.cost.totalMicros;

  return data.rows.map(
    ([id, cost, requests, sessions, lastActivityAt, models, practices, seat]) => {
      let memberCost = costOfCompact(cost);

      return {
        id,
        cost: memberCost,
        share: microsShare(memberCost.totalMicros, totalMicros),
        sessions,
        requests,
        lastActivityAt,
        models: models ? modelsOf(models, memberCost.totalMicros, requests) : null,
        practices: practices
          ? {
              ...practicesOf(practices, memberCost.totalMicros),
              outdatedModels: practices[8].map(([model, costMicros]) => {
                let modelId = data.strings[model]!;
                let [status, isLatest] = data.models[modelId] ?? [null, null];
                return { model: { id: modelId, name: null }, status, isLatest, costMicros };
              })
            }
          : null,
        seat: seat
          ? {
              seat: textAt(data.strings, seat[0]),
              plan: textAt(data.strings, seat[1]),
              listPriceMicros: memberCost.listPriceMicros
            }
          : null
      };
    }
  );
};

let atLeast = (value: number | null | undefined, min: number | undefined) =>
  min !== undefined && value !== null && value !== undefined && value >= min;

let below = (value: number | null | undefined, max: number | undefined) =>
  max !== undefined && value !== null && value !== undefined && value < max;

let flagsOf = (
  row: MemberInsightRow,
  thresholds: MemberInsightsThresholds
): MemberInsightsFlag[] => {
  let fired: Record<MemberInsightsFlag, boolean> = {
    model_share: atLeast(row.models?.costShare, thresholds.modelShareMin),
    high_effort: atLeast(row.practices?.highEffortShare, thresholds.highEffortShareMin),
    fast_mode: atLeast(row.practices?.fastShare, thresholds.fastShareMin),
    outdated_models: atLeast(row.practices?.outdatedShare, thresholds.outdatedShareMin),
    low_cache_hit_rate: below(row.practices?.cacheHitRate, thresholds.cacheHitRateMax),
    low_usage_seat: below(row.seat?.listPriceMicros, thresholds.seatUsageMaxMicros)
  };

  return memberInsightsFlags.filter(flag => fired[flag]);
};

let sortValues: Record<MemberInsightsSort, (row: MemberInsightRow) => number | null> = {
  cost: row => row.cost.totalMicros,
  sessions: row => row.sessions,
  requests: row => row.requests,
  last_activity: row => row.lastActivityAt,
  model_share: row => row.models?.costShare ?? null,
  model_cost: row => row.models?.costMicros ?? null,
  high_effort_share: row => row.practices?.highEffortShare ?? null,
  fast_share: row => row.practices?.fastShare ?? null,
  outdated_share: row => row.practices?.outdatedShare ?? null,
  cache_hit_rate: row => row.practices?.cacheHitRate ?? null,
  seat_usage: row => row.seat?.listPriceMicros ?? null
};

export let rankMemberInsights = (d: {
  rows: MemberInsightRow[];
  sort: MemberInsightsSort;
  order: 'asc' | 'desc';
  thresholds: MemberInsightsThresholds;
  seats: string[] | undefined;
}): AgentTrackingMemberInsightFigures[] => {
  let valueOf = sortValues[d.sort];
  let direction = d.order == 'asc' ? 1 : -1;
  let missing = d.sort == 'last_activity' && d.order == 'asc' ? -1 : 1;
  let seats = d.seats ? new Set(d.seats) : undefined;
  let rows = d.rows.filter(row => !seats || (!!row.seat?.seat && seats.has(row.seat.seat)));

  let sorted = rows.sort((a, b) => {
    let left = valueOf(a);
    let right = valueOf(b);
    if (left !== right) {
      if (left === null) return missing;
      if (right === null) return -missing;
      return (left - right) * direction;
    }

    return byText(a.id, b.id);
  });

  return sorted.map((row, index) => ({
    ...row,
    rank: index + 1,
    lastActivityAt: row.lastActivityAt === null ? null : new Date(row.lastActivityAt),
    flags: flagsOf(row, d.thresholds)
  }));
};

export let flagCountsOf = (
  ranked: AgentTrackingMemberInsightFigures[],
  thresholds: MemberInsightsThresholds
) =>
  Object.fromEntries(
    Object.entries(thresholdParams).map(([key, param]) => [
      param.flag,
      thresholds[key as keyof MemberInsightsThresholds] === undefined
        ? null
        : ranked.filter(row => row.flags.includes(param.flag)).length
    ])
  ) as Record<MemberInsightsFlag, number | null>;
