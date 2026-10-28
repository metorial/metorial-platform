import { chartPalette, type ChartColor, type ChartSeries } from '@metorial/chart';
import { eventsErrorColor, eventsSuccessColor } from '@metorial/metrics-page';
import type { DashboardInstancesUsageTimelineOutput } from '@metorial/state';
import type { UsageKind } from './query';

let errorUsageKinds: UsageKind[] = ['session_error', 'auth_error'];

export let isErrorUsageKinds = (kinds: UsageKind[]) =>
  kinds.length > 0 && kinds.every(kind => errorUsageKinds.includes(kind));

let errorPalette: ChartColor[] = [
  'red',
  'orange',
  'pink',
  'yellow',
  'purple',
  'violet',
  'iris'
];

export type UsageTimeline = DashboardInstancesUsageTimelineOutput;
export type UsagePoint = UsageTimeline['total'][number];
export type UsageTimelineSeries = UsageTimeline['series'][number];

export type UsageMetric = 'count' | 'successCount' | 'errorCount' | 'durationMsSum';

let emptyPoint = (timestamp: Date): UsagePoint => ({
  timestamp,
  count: 0,
  successCount: 0,
  errorCount: 0,
  errorRate: 0,
  durationMsSum: 0,
  durationMsAvg: null,
  durationMsMax: null,
  activeConsumers: 0,
  activeAgents: 0
});

export let sumUsagePoints = (series: UsageTimelineSeries[], timestamps: Date[]) => {
  let byTimestamp = new Map<number, UsagePoint>(
    timestamps.map(timestamp => [timestamp.getTime(), emptyPoint(timestamp)])
  );

  for (let item of series) {
    for (let point of item.points) {
      let target = byTimestamp.get(point.timestamp.getTime());
      if (!target) continue;

      target.count += point.count;
      target.successCount += point.successCount;
      target.errorCount += point.errorCount;
      target.durationMsSum += point.durationMsSum;
      target.durationMsMax =
        point.durationMsMax === null
          ? target.durationMsMax
          : Math.max(target.durationMsMax ?? 0, point.durationMsMax);
      target.activeConsumers = Math.max(target.activeConsumers, point.activeConsumers);
      target.activeAgents = Math.max(target.activeAgents, point.activeAgents);
    }
  }

  return [...byTimestamp.values()].map(point => ({
    ...point,
    errorRate: point.count ? point.errorCount / point.count : 0,
    durationMsAvg:
      point.count && point.durationMsSum ? point.durationMsSum / point.count : null
  }));
};

export let getUsagePointsForKinds = (timeline: UsageTimeline, kinds?: UsageKind[]) => {
  if (!kinds?.length) return timeline.total;

  let timestamps = timeline.total.map(point => point.timestamp);
  let series = timeline.series.filter(item => item.kind && kinds.includes(item.kind));

  return sumUsagePoints(series, timestamps);
};

export let usageMetricSeries = (
  points: UsagePoint[],
  opts: {
    id: string;
    name: string;
    value: (point: UsagePoint) => number | null;
    color?: ChartColor;
    style?: ChartSeries['style'];
  }
): ChartSeries => ({
  id: opts.id,
  name: opts.name,
  color: opts.color,
  style: opts.style,
  entries: points.map(point => ({ key: point.timestamp, value: opts.value(point) }))
});

export type UsageEventsSegment = 'success' | 'error';

export let usageEventsSeries = (
  points: UsagePoint[],
  labels: { success?: string; error?: string } = {},
  segments?: UsageEventsSegment[]
): ChartSeries[] =>
  [
    usageMetricSeries(points, {
      id: 'success',
      name: labels.success ?? 'Success',
      color: eventsSuccessColor,
      value: point => point.successCount
    }),
    usageMetricSeries(points, {
      id: 'error',
      name: labels.error ?? 'Errors',
      color: eventsErrorColor,
      value: point => point.errorCount
    })
  ].filter(series => !segments?.length || segments.includes(series.id as UsageEventsSegment));

let getPaletteColor = (palette: 'default' | 'error' | undefined, i: number) => {
  let colors = palette == 'error' ? errorPalette : chartPalette;
  return colors[i % colors.length];
};

export let usageGroupedSeries = (
  timeline: UsageTimeline,
  opts: {
    getName?: (group: string) => string | undefined;
    otherName?: string;
    unknownName?: string;
    palette?: 'default' | 'error';
    metric?: UsageMetric;
  } = {}
): ChartSeries[] =>
  timeline.series.map((item, i) => {
    let id = item.isOther ? '__other__' : (item.group ?? 'unknown');

    return {
      id,
      name: item.isOther
        ? (opts.otherName ?? 'Other')
        : item.group
          ? (opts.getName?.(item.group) ?? item.group)
          : (opts.unknownName ?? 'Unknown'),
      color: item.isOther ? ('gray' as const) : getPaletteColor(opts.palette, i),
      entries: item.points.map(point => ({
        key: point.timestamp,
        value: point[opts.metric ?? 'count']
      }))
    };
  });

export let formatUsageLabel = (value: string) =>
  value
    .replace(/[_.-]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
    .trim();
