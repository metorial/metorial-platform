import {
  formatDuration,
  formatNumber,
  formatPercent,
  type ChartSeries
} from '@metorial/chart';
import { MetricTile, MetricTileGrid, useMetricsTimeRange } from '@metorial/metrics-page';
import {
  useCurrentInstance,
  useInstanceUsageSummary,
  useInstanceUsageTimeline,
  type DashboardInstancesUsageSummaryOutput
} from '@metorial/state';
import { useMemo } from 'react';
import { getUsageErrorMessage } from './cards';
import {
  toUsageFilterQuery,
  type UsageFilter,
  type UsageInterval,
  type UsageKind,
  type UsageRange
} from './query';
import { getUsagePointsForKinds, usageMetricSeries, type UsagePoint } from './series';

export type UsageTileId =
  | 'tool_calls'
  | 'error_rate'
  | 'sessions'
  | 'connections'
  | 'active_consumers'
  | 'errors'
  | 'latency'
  | 'connection_time'
  | 'auth_failures'
  | 'active_agents';

type Totals = DashboardInstancesUsageSummaryOutput['total'];

type TileContext = {
  kind: (kind: UsageKind) => Totals | undefined;
  points: (kinds: UsageKind[]) => UsagePoint[];
};

type TileDefinition = {
  title: string;
  kinds: UsageKind[];
  value: (ctx: TileContext) => string;
  context?: (ctx: TileContext) => string | undefined;
  sparkline: (ctx: TileContext) => { series: ChartSeries[]; formatter: (n: number) => string };
};

let count = (n: number | undefined) => formatNumber(n ?? 0, { compact: (n ?? 0) >= 10_000 });
let duration = (ms: number | null | undefined) =>
  ms === null || ms === undefined ? '—' : formatDuration(ms);

let spark = (
  points: UsagePoint[],
  value: (point: UsagePoint) => number | null,
  formatter: (n: number) => string = n => formatNumber(n)
) => ({
  series: [usageMetricSeries(points, { id: 'value', name: 'Value', value })],
  formatter
});

let tileDefinitions: Record<Exclude<UsageTileId, DistinctTileId>, TileDefinition> = {
  tool_calls: {
    title: 'Tool calls',
    kinds: ['tool_call'],
    value: ctx => count(ctx.kind('tool_call')?.count),
    context: ctx => {
      let totals = ctx.kind('tool_call');
      return totals?.count ? `${formatPercent(totals.errorRate)} errors` : undefined;
    },
    sparkline: ctx => spark(ctx.points(['tool_call']), p => p.count)
  },
  error_rate: {
    title: 'Error rate',
    kinds: ['tool_call'],
    value: ctx => {
      let totals = ctx.kind('tool_call');
      return totals?.count ? formatPercent(totals.errorRate) : '—';
    },
    context: ctx => `${count(ctx.kind('tool_call')?.errorCount)} failed tool calls`,
    sparkline: ctx =>
      spark(
        ctx.points(['tool_call']),
        p => (p.count ? p.errorRate : null),
        n => formatPercent(n)
      )
  },
  sessions: {
    title: 'Sessions',
    kinds: ['session'],
    value: ctx => count(ctx.kind('session')?.count),
    context: () => 'New sessions',
    sparkline: ctx => spark(ctx.points(['session']), p => p.count)
  },
  connections: {
    title: 'Connections',
    kinds: ['connection'],
    value: ctx => count(ctx.kind('connection')?.count),
    context: () => 'New connections',
    sparkline: ctx => spark(ctx.points(['connection']), p => p.count)
  },
  errors: {
    title: 'Errors',
    kinds: ['session_error', 'auth_error'],
    value: ctx =>
      count((ctx.kind('session_error')?.count ?? 0) + (ctx.kind('auth_error')?.count ?? 0)),
    context: ctx =>
      `${count(ctx.kind('session_error')?.count)} session · ${count(ctx.kind('auth_error')?.count)} auth`,
    sparkline: ctx => spark(ctx.points(['session_error', 'auth_error']), p => p.count)
  },
  latency: {
    title: 'Avg tool latency',
    kinds: ['tool_call'],
    value: ctx => duration(ctx.kind('tool_call')?.durationMsAvg),
    context: ctx => {
      let max = ctx.kind('tool_call')?.durationMsMax;
      return max === null || max === undefined ? undefined : `max ${duration(max)}`;
    },
    sparkline: ctx => spark(ctx.points(['tool_call']), p => p.durationMsAvg, formatDuration)
  },
  connection_time: {
    title: 'Avg connection time',
    kinds: ['connection_time'],
    value: ctx => duration(ctx.kind('connection_time')?.durationMsAvg),
    context: () => 'Per connection',
    sparkline: ctx =>
      spark(ctx.points(['connection_time']), p => p.durationMsAvg, formatDuration)
  },
  auth_failures: {
    title: 'Auth failures',
    kinds: ['auth_event'],
    value: ctx => count(ctx.kind('auth_event')?.errorCount),
    context: ctx => `of ${count(ctx.kind('auth_event')?.count)} authentications`,
    sparkline: ctx => spark(ctx.points(['auth_event']), p => p.errorCount)
  }
};

let distinctTiles = {
  active_consumers: {
    title: 'Active clients',
    context: 'Distinct clients',
    value: (point: { activeConsumers: number }) => point.activeConsumers
  },
  active_agents: {
    title: 'Active agents',
    context: 'Distinct agents',
    value: (point: { activeAgents: number }) => point.activeAgents
  }
};

type DistinctTileId = keyof typeof distinctTiles;

let isDistinctTile = (tile: UsageTileId): tile is DistinctTileId => tile in distinctTiles;

let useTilesRange = (range: UsageRange | undefined) => {
  let live = useMetricsTimeRange(
    { type: 'preset', preset: '24h' },
    { refreshIntervalMs: 60_000 }
  );

  return useMemo(() => {
    if (range) return range;

    let to = new Date(live.to);
    to.setSeconds(0, 0);
    return {
      from: new Date(to.getTime() - 24 * 60 * 60 * 1000),
      to,
      interval: '1h' as UsageInterval
    };
  }, [live.to, range]);
};

let DistinctTile = ({
  tile,
  filter,
  range,
  href
}: {
  tile: DistinctTileId;
  filter?: UsageFilter;
  range: UsageRange;
  href?: string;
}) => {
  let definition = distinctTiles[tile];
  let instance = useCurrentInstance();
  let query = {
    ...toUsageFilterQuery(filter),
    kind: ['tool_call', 'connection'] as UsageKind[],
    from: range.from,
    to: range.to
  };
  let timeline = useInstanceUsageTimeline(instance.data?.id, {
    ...query,
    interval: range.interval
  });
  let summary = useInstanceUsageSummary(instance.data?.id, query);

  let points = timeline.data?.total ?? [];

  return (
    <MetricTile
      title={definition.title}
      value={count(summary.data ? definition.value(summary.data.total) : 0)}
      context={definition.context}
      href={href}
      loading={timeline.isLoading || summary.isLoading}
      error={getUsageErrorMessage(timeline.error ?? summary.error)}
      sparkline={{
        series: [
          usageMetricSeries(points, {
            id: 'value',
            name: definition.title,
            value: definition.value
          })
        ],
        valueFormatter: n => formatNumber(n),
        yMin: 0,
        xAxis: 'time',
        domain: range,
        tooltip: true
      }}
    />
  );
};

export let UsageOverviewTiles = ({
  filter,
  tiles,
  range: selectedRange,
  href
}: {
  filter?: UsageFilter;
  tiles: UsageTileId[];
  range?: UsageRange;
  href?: string;
}) => {
  let instance = useCurrentInstance();
  let range = useTilesRange(selectedRange);

  let kinds = useMemo(
    () => [
      ...new Set(
        tiles.flatMap(tile => (isDistinctTile(tile) ? [] : tileDefinitions[tile].kinds))
      )
    ],
    [tiles.join(',')]
  );

  let query = kinds.length
    ? { ...toUsageFilterQuery(filter), kind: kinds, from: range.from, to: range.to }
    : null;

  let timeline = useInstanceUsageTimeline(
    instance.data?.id,
    query ? { ...query, interval: range.interval, groupBy: 'kind' } : null
  );
  let summary = useInstanceUsageSummary(instance.data?.id, query);

  let ctx = useMemo<TileContext>(
    () => ({
      kind: kind => summary.data?.byKind.find(item => item.kind == kind),
      points: kinds => (timeline.data ? getUsagePointsForKinds(timeline.data, kinds) : [])
    }),
    [summary.data, timeline.data]
  );

  let loading = timeline.isLoading || summary.isLoading;
  let error = getUsageErrorMessage(timeline.error ?? summary.error);

  return (
    <MetricTileGrid>
      {tiles.map(tile => {
        if (isDistinctTile(tile)) {
          return (
            <DistinctTile key={tile} tile={tile} filter={filter} range={range} href={href} />
          );
        }

        let definition = tileDefinitions[tile];
        let sparkline = definition.sparkline(ctx);

        return (
          <MetricTile
            key={tile}
            title={definition.title}
            value={definition.value(ctx)}
            context={definition.context?.(ctx)}
            href={href}
            loading={loading}
            error={error}
            sparkline={{
              series: sparkline.series,
              valueFormatter: sparkline.formatter,
              yMin: 0,
              xAxis: 'time',
              domain: range,
              tooltip: true
            }}
          />
        );
      })}
    </MetricTileGrid>
  );
};
