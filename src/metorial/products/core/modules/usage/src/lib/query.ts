import { UsageMetricModel } from '../models';
import { emptyUsageCounters } from './bucket';
import { getUsageBucketStarts } from './interval';
import {
  USAGE_OTHER_GROUP,
  usageGroupByDimensions,
  type UsageCounters,
  type UsageFilter,
  type UsageGroupBy,
  type UsageMetricKind
} from './types';

type AggregatedRow = UsageCounters & {
  _id: { kind: UsageMetricKind; group: string | null; bucket?: number };
  consumers?: (string | null)[];
  agents?: (string | null)[];
};

export type UsagePoint = UsageCounters & {
  ts: Date;
  activeConsumers: number;
  activeAgents: number;
};

export type UsageSeries = {
  kind: UsageMetricKind | null;
  group: string | null;
  points: UsagePoint[];
};

export type UsageTotals = UsageCounters & {
  activeConsumers: number;
  activeAgents: number;
};

let buildMatch = (filter: UsageFilter) => {
  let match: Record<string, any> = {
    instanceId: { $in: filter.instanceIds },
    kind: { $in: filter.kinds },
    ts: { $gte: filter.from, $lt: filter.to }
  };

  for (let [key, values] of Object.entries(filter.dims ?? {})) {
    if (values?.length) match[`dims.${key}`] = { $in: values };
  }

  return match;
};

let getGroupExpression = (groupBy: UsageGroupBy | undefined) => {
  if (!groupBy || groupBy == 'kind') return null;
  return `$dims.${usageGroupByDimensions[groupBy]}`;
};

let counterAccumulators = {
  count: { $sum: '$count' },
  errorCount: { $sum: '$errorCount' },
  durationMsSum: { $sum: '$durationMsSum' },
  durationCount: { $sum: '$durationCount' },
  durationMsMax: { $max: '$durationMsMax' }
};

let addCounters = (target: UsageCounters, source: UsageCounters) => {
  target.count += source.count ?? 0;
  target.errorCount += source.errorCount ?? 0;
  target.durationMsSum += source.durationMsSum ?? 0;
  target.durationCount += source.durationCount ?? 0;
  target.durationMsMax = Math.max(target.durationMsMax, source.durationMsMax ?? 0);
};

let addDistinct = (target: Set<string>, values: (string | null)[] | undefined) => {
  for (let value of values ?? []) {
    if (value) target.add(value);
  }
};

let distinctAccumulators = {
  consumers: { $addToSet: '$dims.consumerId' },
  agents: { $addToSet: '$dims.agentId' }
};

let countDistinct = (values: (string | null)[] | undefined) =>
  (values ?? []).filter(Boolean).length;

let pickTopGroups = (rows: AggregatedRow[], maxSeries: number) => {
  let totals = new Map<string | null, number>();
  for (let row of rows) {
    totals.set(row._id.group, (totals.get(row._id.group) ?? 0) + row.count);
  }

  return new Set(
    [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxSeries)
      .map(([group]) => group)
  );
};

export let queryUsageTimeline = async (
  filter: UsageFilter & {
    intervalMs: number;
    groupBy?: UsageGroupBy;
    maxSeries: number;
    includeDistinct: boolean;
  }
) => {
  let rows = (await UsageMetricModel.aggregate([
    { $match: buildMatch(filter) },
    {
      $group: {
        _id: {
          kind: '$kind',
          group: getGroupExpression(filter.groupBy),
          bucket: {
            $subtract: [{ $toLong: '$ts' }, { $mod: [{ $toLong: '$ts' }, filter.intervalMs] }]
          }
        },
        ...counterAccumulators,
        ...(filter.includeDistinct ? distinctAccumulators : {})
      }
    }
  ])) as AggregatedRow[];

  let bucketStarts = getUsageBucketStarts(filter);
  let topGroups = filter.groupBy
    ? pickTopGroups(rows, filter.maxSeries)
    : new Set<string | null>([null]);

  let createPoints = () =>
    new Map(
      bucketStarts.map(start => [
        start,
        {
          counters: emptyUsageCounters(),
          consumers: new Set<string>(),
          agents: new Set<string>()
        }
      ])
    );

  let total = createPoints();
  let series = new Map<
    string,
    {
      kind: UsageMetricKind | null;
      group: string | null;
      points: ReturnType<typeof createPoints>;
    }
  >();

  for (let row of rows) {
    let bucket = Number(row._id.bucket);
    let group = topGroups.has(row._id.group) ? row._id.group : USAGE_OTHER_GROUP;
    let kind = filter.groupBy && filter.groupBy != 'kind' ? null : row._id.kind;
    let seriesKey = JSON.stringify([kind, group]);

    let entry = series.get(seriesKey);
    if (!entry) {
      entry = { kind, group, points: createPoints() };
      series.set(seriesKey, entry);
    }

    for (let target of [entry.points.get(bucket), total.get(bucket)]) {
      if (!target) continue;

      addCounters(target.counters, row);
      addDistinct(target.consumers, row.consumers);
      addDistinct(target.agents, row.agents);
    }
  }

  let presentPoints = (points: ReturnType<typeof createPoints>): UsagePoint[] =>
    [...points.entries()].map(([ts, point]) => ({
      ts: new Date(ts),
      ...point.counters,
      activeConsumers: point.consumers.size,
      activeAgents: point.agents.size
    }));

  return {
    total: presentPoints(total),
    series: [...series.values()].map(
      (entry): UsageSeries => ({
        kind: entry.kind,
        group: entry.group,
        points: presentPoints(entry.points)
      })
    )
  };
};

export let queryUsageSummary = async (
  filter: UsageFilter & {
    groupBy?: UsageGroupBy;
    maxSeries: number;
    includeDistinct: boolean;
  }
) => {
  let distinctAccumulator = filter.includeDistinct ? distinctAccumulators : {};

  let [kindRows, groupRows] = await Promise.all([
    UsageMetricModel.aggregate([
      { $match: buildMatch(filter) },
      {
        $group: {
          _id: { kind: '$kind', group: null },
          ...counterAccumulators,
          ...distinctAccumulator
        }
      }
    ]) as Promise<AggregatedRow[]>,

    filter.groupBy
      ? (UsageMetricModel.aggregate([
          { $match: buildMatch(filter) },
          {
            $group: {
              _id: {
                kind: filter.groupBy == 'kind' ? '$kind' : null,
                group: getGroupExpression(filter.groupBy) ?? '$kind'
              },
              ...counterAccumulators,
              ...distinctAccumulator
            }
          },
          { $sort: { count: -1 } },
          { $limit: filter.maxSeries }
        ]) as Promise<AggregatedRow[]>)
      : Promise.resolve([] as AggregatedRow[])
  ]);

  let total = emptyUsageCounters();
  let totalConsumers = new Set<string>();
  let totalAgents = new Set<string>();

  let kinds = filter.kinds.map(kind => {
    let counters = emptyUsageCounters();
    let consumers = new Set<string>();
    let agents = new Set<string>();

    for (let row of kindRows.filter(candidate => candidate._id.kind == kind)) {
      addCounters(counters, row);
      addDistinct(consumers, row.consumers);
      addDistinct(agents, row.agents);
      addCounters(total, row);
      addDistinct(totalConsumers, row.consumers);
      addDistinct(totalAgents, row.agents);
    }

    return {
      kind,
      ...counters,
      activeConsumers: consumers.size,
      activeAgents: agents.size
    };
  });

  return {
    total: {
      ...total,
      activeConsumers: totalConsumers.size,
      activeAgents: totalAgents.size
    } satisfies UsageTotals,
    kinds,
    top: groupRows.map(row => ({
      group: row._id.group,
      count: row.count,
      errorCount: row.errorCount,
      durationMsSum: row.durationMsSum,
      durationCount: row.durationCount,
      durationMsMax: row.durationMsMax ?? 0,
      activeConsumers: countDistinct(row.consumers),
      activeAgents: countDistinct(row.agents)
    }))
  };
};
