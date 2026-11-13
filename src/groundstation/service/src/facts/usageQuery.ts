import { badRequestError, ServiceError } from '@lowerdeck/error';
import { isValidKindKey } from '../entities/kinds';
import type { DimensionMaps } from '../knowledge/dimensions';
import { dimensionResolverOf, type DimensionContext } from './dimensions';

let dayMs = 24 * 60 * 60 * 1000;

export let maxRangeDays = 400;
export let maxHourlyRangeDays = 31;
export let maxGroups = 10_000;
export let mappedGroupsFactor = 5;
export let maxGroupBy = 4;
export let defaultLimit = 1000;

export let usageMetrics = [
  'cost.usd',
  'cost.list',
  'cost.contract',
  'cost.reported',
  'tokens',
  'requests',
  'sessions',
  'turns',
  'tool_calls',
  'users.active',
  'lines'
] as const;

export let usageIntervals = ['hour', 'day', 'week', 'month'] as const;

export type UsageMetric = (typeof usageMetrics)[number];

export type UsageInterval = (typeof usageIntervals)[number];

export type Allocation = 'full' | 'split';

export type QueryFilters = Record<string, { in?: string[]; notIn?: string[] }>;

export type UsageQuery = {
  organizationId: string;
  projectIds?: string[];
  instanceIds?: string[];
  range: { from: Date; to: Date };
  interval?: UsageInterval;
  timeZone?: string;
  metrics: UsageMetric[];
  groupBy: string[];
  filters: QueryFilters;
  allocation: Allocation;
  orderBy?: { by: string; direction: 'asc' | 'desc' };
  limit?: number;
};

export let usageFieldPaths: Record<string, string> = {
  user: 'userId',
  device: 'deviceId',
  agentId: 'agentId',
  subagent: 'subagentId',
  model: 'modelId',
  vendor: 'vendorId',
  'billing.mode': 'billingMode',
  'billing.source': 'billingSource',
  'billing.plan': 'billingPlan',
  'client.family': 'client.family',
  'client.version': 'client.version',
  'metorial.project': 'projectId',
  'metorial.instance': 'instanceId'
};

type Stage = Record<string, unknown>;

type Expression = unknown;

let fail = (message: string): never => {
  throw new ServiceError(badRequestError({ message }));
};

export let isValidTimeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
};

let pathOf = (paths: Record<string, string>, field: string) =>
  Object.hasOwn(paths, field) ? paths[field] : undefined;

export let isKindField = (field: string) =>
  !pathOf(usageFieldPaths, field) && !dimensionResolverOf(field) && isValidKindKey(field);

let isUsageField = (field: string) =>
  !!pathOf(usageFieldPaths, field) || !!dimensionResolverOf(field) || isKindField(field);

export let usesDimensions = (query: Pick<UsageQuery, 'groupBy' | 'filters'>) =>
  [...query.groupBy, ...Object.keys(query.filters)].some(field => dimensionResolverOf(field));

// Mapped fields merge several Mongo groups into one, so Mongo may return more groups than the
// final result is allowed to have.
export let mongoGroupCap = (query: Pick<UsageQuery, 'groupBy'>) =>
  query.groupBy.some(field => dimensionResolverOf(field))
    ? maxGroups * mappedGroupsFactor
    : maxGroups;

export let assertRange = (range: { from: Date; to: Date }, maxDays: number = maxRangeDays) => {
  let spanMs = range.to.getTime() - range.from.getTime();

  if (spanMs <= 0) fail('The range must end after it starts.');
  if (spanMs > maxDays * dayMs) fail(`The range may span at most ${maxDays} days.`);
};

export let validateUsageQuery = (query: UsageQuery) => {
  assertRange(query.range, query.interval == 'hour' ? maxHourlyRangeDays : maxRangeDays);

  if (query.timeZone && !isValidTimeZone(query.timeZone)) {
    fail(`Unknown time zone "${query.timeZone}".`);
  }
  if (!query.metrics.length) fail('Pick at least one metric.');
  if (query.groupBy.length > maxGroupBy) fail(`Group by at most ${maxGroupBy} fields.`);
  if (new Set(query.groupBy).size != query.groupBy.length) fail('groupBy has duplicates.');

  for (let field of query.groupBy) {
    if (!isUsageField(field)) fail(`Unknown groupBy field "${field}".`);
  }

  for (let field of Object.keys(query.filters)) {
    if (!isUsageField(field)) fail(`Unknown filter field "${field}".`);
  }

  let orderBy = query.orderBy?.by;
  let orderable =
    !orderBy ||
    orderBy == 'time' ||
    query.groupBy.includes(orderBy) ||
    (query.metrics.includes(orderBy as UsageMetric) && orderBy != 'cost.reported');
  if (!orderable) fail(`Cannot order by "${orderBy}".`);
};

let kindGroupField = (index: number) => `_g${index}`;

export let filterMatch = (
  filters: QueryFilters,
  paths: Record<string, string>,
  dimIdsPath: string,
  dimensions?: DimensionContext
) => {
  let match: Record<string, unknown> = {};
  let and: Record<string, unknown>[] = [];

  for (let [field, filter] of Object.entries(filters)) {
    let path = pathOf(paths, field);

    if (path) {
      match[path] = {
        ...(filter.in ? { $in: filter.in } : {}),
        ...(filter.notIn ? { $nin: filter.notIn } : {})
      };
      continue;
    }

    let resolver = dimensions && dimensionResolverOf(field);
    if (resolver) {
      if (filter.in) and.push(resolver.match(filter.in, dimensions!));
      if (filter.notIn) and.push({ $nor: [resolver.match(filter.notIn, dimensions!)] });
      continue;
    }

    if (filter.in) and.push({ [dimIdsPath]: { $in: filter.in } });
    if (filter.notIn) and.push({ [dimIdsPath]: { $nin: filter.notIn } });
  }

  if (and.length) match.$and = and;

  return match;
};

export let bucketExpression = (interval: UsageInterval, timeZone: string): Expression => {
  let truncate = (date: Expression) => ({
    $dateTrunc: {
      date,
      unit: interval,
      timezone: timeZone,
      ...(interval == 'week' ? { startOfWeek: 'monday' } : {})
    }
  });

  // Daily aggregates can't be split, so they stay on the calendar day the source reported,
  // whatever the viewer's time zone (07 §8.2).
  let reportedDay = {
    $dateFromParts: {
      year: { $year: '$bucket' },
      month: { $month: '$bucket' },
      day: { $dayOfMonth: '$bucket' },
      timezone: timeZone
    }
  };

  return {
    $cond: [{ $eq: ['$bucketMinutes', 1440] }, truncate(reportedDay), truncate('$bucket')]
  };
};

let weightExpression = (query: UsageQuery): Expression => {
  if (query.allocation != 'split') return 1;

  let factors: Expression[] = query.groupBy
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => isKindField(field))
    .map(({ index }) => ({ $ifNull: [`$${kindGroupField(index)}.w`, 1] }));

  for (let [field, filter] of Object.entries(query.filters)) {
    if (!isKindField(field) || !filter.in || query.groupBy.includes(field)) continue;

    let matching = {
      $filter: { input: { $ifNull: ['$dims', []] }, cond: { $in: ['$$this.id', filter.in] } }
    };

    factors.push({
      $cond: [
        { $gt: [{ $size: matching }, 0] },
        { $min: [1, { $sum: { $map: { input: matching, in: '$$this.w' } } }] },
        1
      ]
    });
  }

  if (!factors.length) return 1;
  if (factors.length == 1) return factors[0];

  return { $multiply: factors };
};

let weighted = (value: Expression, weight: Expression) =>
  weight === 1 ? value : { $multiply: [value, weight] };

let numberOf = (path: string) => ({ $ifNull: [`$${path}`, 0] });

export let usageGroupKey = (query: UsageQuery, timeZone: string) => {
  let key: Record<string, Expression> = {};

  if (query.interval) key.t = bucketExpression(query.interval, timeZone);

  query.groupBy.forEach((field, index) => {
    let resolver = dimensionResolverOf(field);
    let path = resolver?.base ?? pathOf(usageFieldPaths, field);
    key[`k${index}`] = path ? `$${path}` : `$${kindGroupField(index)}.id`;

    if (resolver?.groupsUnresolvedRaw) {
      key[`r${index}`] = {
        $cond: [{ $eq: [{ $ifNull: [`$${resolver.base}`, null] }, null] }, '$modelRaw', null]
      };
    }
  });

  return key;
};

let baseStages = (query: UsageQuery, dimensions: DimensionContext | undefined): Stage[] => {
  let match = {
    organizationId: query.organizationId,
    bucket: { $gte: query.range.from, $lt: query.range.to },
    ...(query.projectIds ? { projectId: { $in: query.projectIds } } : {}),
    ...(query.instanceIds ? { instanceId: { $in: query.instanceIds } } : {}),
    ...filterMatch(query.filters, usageFieldPaths, 'dimIds', dimensions)
  };

  let stages: Stage[] = [{ $match: match }];

  query.groupBy.forEach((field, index) => {
    if (!isKindField(field)) return;

    let name = kindGroupField(index);
    stages.push(
      {
        $addFields: {
          [name]: {
            $filter: {
              input: { $ifNull: ['$dims', []] },
              cond: { $eq: ['$$this.kind', field] }
            }
          }
        }
      },
      { $unwind: { path: `$${name}`, preserveNullAndEmptyArrays: true } }
    );
  });

  return stages;
};

let costSum = (path: string, weight: Expression) => ({
  $sum: weighted({ $toDouble: { $ifNull: [`$${path}`, 0] } }, weight)
});

export let buildUsagePipelines = (query: UsageQuery, dimensions?: DimensionContext) => {
  if (!dimensions && usesDimensions(query)) {
    throw new Error('Mapped usage dimensions need their knowledge maps.');
  }

  let timeZone = query.timeZone ?? 'UTC';
  let weight = weightExpression(query);
  let key = usageGroupKey(query, timeZone);
  let cap = mongoGroupCap(query);

  let accumulators: Record<string, Expression> = {};
  let metrics = new Set(query.metrics);

  if (metrics.has('cost.usd')) accumulators.costUsd = costSum('costUsd', weight);
  if (metrics.has('cost.list')) accumulators.costList = costSum('costComputedUsd', weight);
  if (metrics.has('cost.contract')) {
    accumulators.costContract = costSum('costContractUsd', weight);
  }
  if (metrics.has('tokens')) {
    for (let part of ['inputUncached', 'cacheRead', 'cacheWrite', 'output', 'reasoning']) {
      accumulators[`tokens_${part}`] = { $sum: weighted(numberOf(`tokens.${part}`), weight) };
    }
  }
  if (metrics.has('requests')) {
    accumulators.requests = { $sum: weighted(numberOf('requests'), weight) };
  }
  if (metrics.has('sessions')) {
    accumulators.sessions = { $sum: weighted(numberOf('sessionsStarted'), weight) };
  }
  if (metrics.has('turns')) accumulators.turns = { $sum: weighted(numberOf('turns'), weight) };
  if (metrics.has('tool_calls')) {
    accumulators.toolCalls = { $sum: weighted(numberOf('toolCalls'), weight) };
  }
  if (metrics.has('lines')) {
    accumulators.linesAdded = { $sum: weighted(numberOf('lines.added'), weight) };
    accumulators.linesRemoved = { $sum: weighted(numberOf('lines.removed'), weight) };
  }
  if (metrics.has('users.active')) accumulators.users = { $addToSet: '$userId' };

  let main: Stage[] = [
    ...baseStages(query, dimensions),
    { $group: { _id: key, ...accumulators } },
    { $limit: cap + 1 }
  ];

  let reported: Stage[] | null = metrics.has('cost.reported')
    ? [
        ...baseStages(query, dimensions),
        { $unwind: '$costReported' },
        {
          $group: {
            _id: { ...key, unit: '$costReported.unit', basis: '$costReported.basis' },
            amount: {
              $sum: weighted({ $toDouble: { $ifNull: ['$costReported.amount', 0] } }, weight)
            }
          }
        },
        { $limit: cap * 4 }
      ]
    : null;

  return { main, reported };
};

export type UsageGroupRow = {
  _id: Record<string, unknown>;
  costUsd?: number;
  costList?: number;
  costContract?: number;
  tokens_inputUncached?: number;
  tokens_cacheRead?: number;
  tokens_cacheWrite?: number;
  tokens_output?: number;
  tokens_reasoning?: number;
  requests?: number;
  sessions?: number;
  turns?: number;
  toolCalls?: number;
  linesAdded?: number;
  linesRemoved?: number;
  users?: (string | null)[];
};

export type ReportedCostRow = {
  _id: Record<string, unknown>;
  amount: number;
};

export type UsageRow = {
  time?: Date;
  keys: Record<string, string | null>;
  metrics: {
    'cost.usd'?: number;
    'cost.list'?: number;
    'cost.contract'?: number;
    'cost.reported'?: { unit: string; basis: string; amount: number }[];
    tokens?: {
      inputUncached: number;
      cacheRead: number;
      cacheWrite: number;
      output: number;
      reasoning: number;
      total: number;
    };
    requests?: number;
    sessions?: number;
    turns?: number;
    tool_calls?: number;
    'users.active'?: number;
    lines?: { added: number; removed: number };
  };
};

type MergedRow = {
  time?: Date;
  keys: Record<string, string | null>;
  sums: Record<string, number>;
  users: Set<string>;
  reported: Map<string, { unit: string; basis: string; amount: number }>;
};

let round = (value: number) => Math.round(value * 1e9) / 1e9;

let keyValue = (value: unknown) =>
  value === undefined || value === null ? null : String(value);

let numericMetric = (row: UsageRow, by: string): number | null => {
  let metrics = row.metrics;

  if (by == 'tokens') return metrics.tokens?.total ?? null;
  if (by == 'lines') return metrics.lines ? metrics.lines.added + metrics.lines.removed : null;

  let value = metrics[by as keyof UsageRow['metrics']];
  return typeof value == 'number' ? value : null;
};

let compareValues = (a: unknown, b: unknown) => {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a == 'number' && typeof b == 'number') return a - b;

  return String(a) < String(b) ? -1 : 1;
};

export let finalizeUsageRows = (d: {
  query: UsageQuery;
  rows: UsageGroupRow[];
  reported?: ReportedCostRow[];
  maps?: DimensionMaps;
}): { rows: UsageRow[]; truncated: boolean } => {
  let { query } = d;
  let tooManyGroups = () =>
    fail(
      `The query produces more than ${maxGroups} groups; narrow the range or the grouping.`
    );

  if (d.rows.length > mongoGroupCap(query)) tooManyGroups();

  let resolvers = query.groupBy.map(field => dimensionResolverOf(field));
  if (resolvers.some(Boolean) && !d.maps) {
    throw new Error('Mapped usage dimensions need their knowledge maps.');
  }

  let keysOf = (id: Record<string, unknown>) => {
    let keys: Record<string, string | null> = {};

    query.groupBy.forEach((field, index) => {
      let value = keyValue(id[`k${index}`]);
      let resolver = resolvers[index];

      keys[field] = resolver
        ? resolver.map({ value, raw: keyValue(id[`r${index}`]), maps: d.maps! })
        : value;
    });

    return keys;
  };

  let identity = (time: unknown, keys: Record<string, string | null>) =>
    JSON.stringify([
      time instanceof Date ? time.toISOString() : null,
      query.groupBy.map(f => keys[f])
    ]);

  let merged = new Map<string, MergedRow>();

  let rowFor = (id: Record<string, unknown>) => {
    let keys = keysOf(id);
    let time = id.t instanceof Date ? id.t : undefined;
    let mapKey = identity(time, keys);

    let row = merged.get(mapKey);
    if (!row) {
      row = { time, keys, sums: {}, users: new Set(), reported: new Map() };
      merged.set(mapKey, row);
    }

    return row;
  };

  for (let raw of d.rows) {
    let row = rowFor(raw._id);

    for (let [name, value] of Object.entries(raw)) {
      if (name == '_id' || name == 'users' || typeof value != 'number') continue;
      row.sums[name] = (row.sums[name] ?? 0) + value;
    }

    for (let user of raw.users ?? []) if (user) row.users.add(user);
  }

  for (let raw of d.reported ?? []) {
    let row = rowFor(raw._id);
    let unit = String(raw._id.unit ?? '');
    let basis = String(raw._id.basis ?? '');
    let costKey = `${unit}\u0000${basis}`;

    let current = row.reported.get(costKey) ?? { unit, basis, amount: 0 };
    current.amount += raw.amount;
    row.reported.set(costKey, current);
  }

  if (merged.size > maxGroups) tooManyGroups();

  let metrics = new Set(query.metrics);

  let rows = [...merged.values()].map((row): UsageRow => {
    let sum = (name: string) => round(row.sums[name] ?? 0);
    let result: UsageRow = {
      ...(row.time ? { time: row.time } : {}),
      keys: row.keys,
      metrics: {}
    };

    if (metrics.has('cost.usd')) result.metrics['cost.usd'] = sum('costUsd');
    if (metrics.has('cost.list')) result.metrics['cost.list'] = sum('costList');
    if (metrics.has('cost.contract')) result.metrics['cost.contract'] = sum('costContract');
    if (metrics.has('cost.reported')) {
      result.metrics['cost.reported'] = [...row.reported.values()]
        .map(cost => ({ ...cost, amount: round(cost.amount) }))
        .sort((a, b) => compareValues(a.unit + a.basis, b.unit + b.basis));
    }
    if (metrics.has('tokens')) {
      let tokens = {
        inputUncached: sum('tokens_inputUncached'),
        cacheRead: sum('tokens_cacheRead'),
        cacheWrite: sum('tokens_cacheWrite'),
        output: sum('tokens_output'),
        reasoning: sum('tokens_reasoning')
      };
      result.metrics.tokens = {
        ...tokens,
        total: round(Object.values(tokens).reduce((total, value) => total + value, 0))
      };
    }
    if (metrics.has('requests')) result.metrics.requests = sum('requests');
    if (metrics.has('sessions')) result.metrics.sessions = sum('sessions');
    if (metrics.has('turns')) result.metrics.turns = sum('turns');
    if (metrics.has('tool_calls')) result.metrics.tool_calls = sum('toolCalls');
    if (metrics.has('users.active')) result.metrics['users.active'] = row.users.size;
    if (metrics.has('lines')) {
      result.metrics.lines = { added: sum('linesAdded'), removed: sum('linesRemoved') };
    }

    return result;
  });

  let firstNumeric = query.metrics.find(metric => metric != 'cost.reported');
  let order = query.orderBy ?? {
    by: query.interval ? 'time' : (firstNumeric ?? 'time'),
    direction: query.interval ? ('asc' as const) : ('desc' as const)
  };
  let direction = order.direction == 'asc' ? 1 : -1;

  let sortValue = (row: UsageRow) => {
    if (order.by == 'time') return row.time ?? null;
    if (query.groupBy.includes(order.by)) return row.keys[order.by] ?? null;

    return numericMetric(row, order.by);
  };

  rows.sort((a, b) => {
    let primary = sortValue(a);
    let secondary = sortValue(b);

    if (primary === null || secondary === null) {
      if (primary !== secondary) return primary === null ? 1 : -1;
    } else {
      let compared = compareValues(primary, secondary) * direction;
      if (compared) return compared;
    }

    return compareValues(identity(a.time, a.keys), identity(b.time, b.keys));
  });

  let limit = query.limit ?? defaultLimit;

  return { rows: rows.slice(0, limit), truncated: rows.length > limit };
};
