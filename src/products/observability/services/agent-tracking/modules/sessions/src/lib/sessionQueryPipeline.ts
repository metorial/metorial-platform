import { badRequestError, ServiceError } from '@lowerdeck/error';
import { isValidKindKey } from '@mtsrc/agent-tracking-module-entities';
import {
  assertRange,
  filterMatch,
  maxGroupBy,
  maxGroups,
  type QueryFilters
} from '@mtsrc/agent-tracking-module-usage';

export let maxTopSessions = 100;

export let sessionStats = ['count', 'avg', 'p50', 'p90', 'sum'] as const;

export let sessionMetrics = ['cost.usd', 'durationMs', 'requests', 'turns'] as const;

export let sessionTopFields = ['cost.usd', 'requests', 'durationMs'] as const;

export type SessionStat = (typeof sessionStats)[number];

export type SessionMetric = (typeof sessionMetrics)[number];

export type SessionQuery = {
  organizationId: string;
  projectIds?: string[];
  instanceIds?: string[];
  range: { from: Date; to: Date };
  filters: QueryFilters;
  groupBy: string[];
  stats: SessionStat[];
  metrics?: SessionMetric[];
  top?: { by: (typeof sessionTopFields)[number]; limit: number };
};

export let sessionFieldPaths: Record<string, string> = {
  user: 'observed.userId',
  device: 'observed.deviceId',
  agent: 'observed.agentId',
  'client.family': 'client.family',
  'client.surface': 'client.surface',
  'client.version': 'client.version',
  'metorial.project': 'projectId',
  'metorial.instance': 'instanceId',
  state: 'state',
  origin: 'origin'
};

export let sessionMetricPaths: Record<SessionMetric, string> = {
  'cost.usd': 'summary.costUsd',
  durationMs: 'summary.durationMs',
  requests: 'summary.requests',
  turns: 'summary.turns'
};

let metricKeys: Record<SessionMetric, string> = {
  'cost.usd': 'costUsd',
  durationMs: 'durationMs',
  requests: 'requests',
  turns: 'turns'
};

type Stage = Record<string, unknown>;

let fail = (message: string): never => {
  throw new ServiceError(badRequestError({ message }));
};

let isSessionKindField = (field: string) =>
  !(field in sessionFieldPaths) && isValidKindKey(field);

export let validateSessionQuery = (query: SessionQuery) => {
  assertRange(query.range);

  if (!query.stats.length) fail('Pick at least one statistic.');
  if (query.groupBy.length > maxGroupBy) fail(`Group by at most ${maxGroupBy} fields.`);

  for (let field of [...query.groupBy, ...Object.keys(query.filters)]) {
    if (!(field in sessionFieldPaths) && !isSessionKindField(field)) {
      fail(`Unknown field "${field}".`);
    }
  }
};

let metricsOf = (query: SessionQuery) => query.metrics ?? [...sessionMetrics];

export let sessionMatch = (query: SessionQuery) => ({
  organizationId: query.organizationId,
  startedAt: { $gte: query.range.from, $lt: query.range.to },
  ...(query.projectIds ? { projectId: { $in: query.projectIds } } : {}),
  ...(query.instanceIds ? { instanceId: { $in: query.instanceIds } } : {}),
  ...filterMatch(query.filters, sessionFieldPaths, 'attribution.dimIds')
});

export let buildSessionPipeline = (query: SessionQuery): Stage[] => {
  let stages: Stage[] = [{ $match: sessionMatch(query) }];
  let key: Record<string, unknown> = {};

  query.groupBy.forEach((field, index) => {
    let path = sessionFieldPaths[field];
    if (path) {
      key[`k${index}`] = `$${path}`;
      return;
    }

    let name = `_g${index}`;
    stages.push(
      {
        $addFields: {
          [name]: {
            $filter: {
              input: { $ifNull: ['$attribution.entries', []] },
              cond: { $eq: ['$$this.kind', field] }
            }
          }
        }
      },
      { $unwind: { path: `$${name}`, preserveNullAndEmptyArrays: true } }
    );
    key[`k${index}`] = `$${name}.entityId`;
  });

  let stats = new Set(query.stats);
  let accumulators: Record<string, unknown> = { count: { $sum: 1 } };

  for (let metric of metricsOf(query)) {
    let value = { $toDouble: `$${sessionMetricPaths[metric]}` };
    let name = metricKeys[metric];

    if (stats.has('sum')) accumulators[`${name}_sum`] = { $sum: { $ifNull: [value, 0] } };
    if (stats.has('avg')) accumulators[`${name}_avg`] = { $avg: value };
    if (stats.has('p50') || stats.has('p90'))
      accumulators[`${name}_values`] = { $push: value };
  }

  stages.push({ $group: { _id: key, ...accumulators } }, { $limit: maxGroups + 1 });

  return stages;
};

export let buildTopSessionsQuery = (query: SessionQuery) => {
  if (!query.top) return null;

  return {
    filter: { ...sessionMatch(query), [sessionMetricPaths[query.top.by]]: { $ne: null } },
    sort: { [sessionMetricPaths[query.top.by]]: -1 as const, _id: 1 as const },
    limit: Math.min(query.top.limit, maxTopSessions)
  };
};

export let percentile = (values: number[], p: number) => {
  if (!values.length) return null;

  let sorted = [...values].sort((a, b) => a - b);
  let index = p * (sorted.length - 1);
  let lower = Math.floor(index);
  let upper = Math.ceil(index);

  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (index - lower);
};

export type SessionGroupRow = { _id: Record<string, unknown>; count: number } & Record<
  string,
  unknown
>;

export type SessionStatValues = {
  sum?: number;
  avg?: number | null;
  p50?: number | null;
  p90?: number | null;
};

export type SessionGroup = {
  keys: Record<string, string | null>;
  count: number;
  stats: Partial<Record<SessionMetric, SessionStatValues>>;
};

let round = (value: number | null) => (value === null ? null : Math.round(value * 1e9) / 1e9);

export let finalizeSessionGroups = (query: SessionQuery, rows: SessionGroupRow[]) => {
  if (rows.length > maxGroups) {
    fail(
      `The query produces more than ${maxGroups} groups; narrow the range or the grouping.`
    );
  }

  let stats = new Set(query.stats);

  return rows
    .map((row): SessionGroup => {
      let keys: Record<string, string | null> = {};
      query.groupBy.forEach((field, index) => {
        let value = row._id[`k${index}`];
        keys[field] = value === undefined || value === null ? null : String(value);
      });

      let result: SessionGroup = { keys, count: row.count, stats: {} };

      for (let metric of metricsOf(query)) {
        let name = metricKeys[metric];
        let values = ((row[`${name}_values`] as (number | null)[] | undefined) ?? []).filter(
          (value): value is number => typeof value == 'number'
        );
        let entry: SessionStatValues = {};

        if (stats.has('sum')) entry.sum = round((row[`${name}_sum`] as number) ?? 0)!;
        if (stats.has('avg')) entry.avg = round((row[`${name}_avg`] as number | null) ?? null);
        if (stats.has('p50')) entry.p50 = round(percentile(values, 0.5));
        if (stats.has('p90')) entry.p90 = round(percentile(values, 0.9));

        result.stats[metric] = entry;
      }

      return result;
    })
    .sort(
      (a, b) =>
        b.count - a.count || JSON.stringify(a.keys).localeCompare(JSON.stringify(b.keys))
    );
};
