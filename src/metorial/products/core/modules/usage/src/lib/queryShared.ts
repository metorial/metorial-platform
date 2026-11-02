import { emptyUsageCounters } from './bucket';
import { getUsageBucketStarts } from './interval';
import {
  USAGE_OTHER_GROUP,
  type UsageCounters,
  type UsageFilter,
  type UsageGroupBy,
  type UsageMetricKind
} from './types';

export type AggregatedRow = UsageCounters & {
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

export let assembleUsageTimeline = (
  rows: AggregatedRow[],
  filter: UsageFilter & { intervalMs: number; groupBy?: UsageGroupBy; maxSeries: number }
) => {
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
    series: [...series.values()].map((entry): UsageSeries => ({
      kind: entry.kind,
      group: entry.group,
      points: presentPoints(entry.points)
    }))
  };
};
export let assembleUsageSummary = (
  kindRows: AggregatedRow[],
  groupRows: AggregatedRow[],
  filter: UsageFilter
) => {
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
