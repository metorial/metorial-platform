import type { ChartColor, ChartSeriesStyle } from './colors';
import { ChartTime, toTimestamp } from './time';

export type ChartEntry = {
  key: ChartTime;
  value: number | null;
};

export type ChartSeries = {
  id: string;
  name: string;
  entries: ChartEntry[];
  style?: ChartSeriesStyle;
  color?: ChartColor;
};

export type ChartReferenceLine = {
  value: number;
  label?: string;
  color?: ChartColor;
};

export type ChartDomain = {
  from: ChartTime;
  to: ChartTime;
};

export type ChartXAxis = 'time' | 'category';

let placeholderValues = [12, 18, 15, 28, 24, 35, 31, 42, 38, 47, 43, 54];

let isValue = (value: number | null): value is number =>
  value !== null && Number.isFinite(value);

export let hasChartData = (series: ChartSeries[]) =>
  series.some(item => item.entries.some(entry => isValue(entry.value)));

export let getValueBounds = (
  series: ChartSeries[],
  referenceLines: ChartReferenceLine[] = []
) => {
  let min = Infinity;
  let max = -Infinity;
  let capacityMax = -Infinity;

  for (let item of series) {
    for (let entry of item.entries) {
      if (!isValue(entry.value)) continue;

      min = Math.min(min, entry.value);
      if (item.style == 'dashed') capacityMax = Math.max(capacityMax, entry.value);
      else max = Math.max(max, entry.value);
    }
  }

  for (let line of referenceLines) {
    min = Math.min(min, line.value);
    capacityMax = Math.max(capacityMax, line.value);
  }

  return { min, max, capacityMax };
};

export let getStackedMax = (series: ChartSeries[]) => {
  let totals = new Map<number, number>();

  for (let item of series) {
    for (let entry of item.entries) {
      if (!isValue(entry.value)) continue;

      let key = toTimestamp(entry.key);
      totals.set(key, (totals.get(key) ?? 0) + entry.value);
    }
  }

  return Math.max(0, ...totals.values());
};

export let getTimeSpan = (series: ChartSeries[], domain?: ChartDomain) => {
  if (domain) return Math.max(toTimestamp(domain.to) - toTimestamp(domain.from), 0);

  let min = Infinity;
  let max = -Infinity;

  for (let item of series) {
    for (let entry of item.entries) {
      let timestamp = toTimestamp(entry.key);
      if (Number.isNaN(timestamp)) continue;

      min = Math.min(min, timestamp);
      max = Math.max(max, timestamp);
    }
  }

  return max > min ? max - min : 0;
};

export let getSmallestTimeStep = (series: ChartSeries[]) => {
  let smallest = Infinity;

  for (let item of series) {
    for (let i = 1; i < item.entries.length; i++) {
      let step = toTimestamp(item.entries[i].key) - toTimestamp(item.entries[i - 1].key);
      if (step > 0) smallest = Math.min(smallest, step);
    }
  }

  return smallest;
};

let MAX_FILLED_BUCKETS = 5000;

export let fillTimeBuckets = (
  series: ChartSeries[],
  stepMs: number,
  domain?: ChartDomain
): ChartSeries[] => {
  if (!(stepMs > 0) || !Number.isFinite(stepMs)) return series;

  let stamps = series.flatMap(item => item.entries.map(entry => toTimestamp(entry.key)));
  if (!stamps.length) return series;

  let anchor = Math.min(...stamps);
  if (stamps.some(stamp => (stamp - anchor) % stepMs != 0)) return series;

  let start = anchor;
  let end = Math.max(...stamps);

  if (domain) {
    let from = toTimestamp(domain.from);
    let to = toTimestamp(domain.to);
    if (from < start) start -= Math.floor((start - from) / stepMs) * stepMs;
    if (to - 1 > end) end += Math.floor((to - 1 - end) / stepMs) * stepMs;
  }

  let count = (end - start) / stepMs + 1;
  if (count > MAX_FILLED_BUCKETS) return series;

  return series.map(item => {
    let byStamp = new Map(item.entries.map(entry => [toTimestamp(entry.key), entry.value]));

    return {
      ...item,
      entries: Array.from({ length: count }, (_, i) => {
        let stamp = start + i * stepMs;
        return { key: new Date(stamp), value: byStamp.get(stamp) ?? 0 };
      })
    };
  });
};

export let getPlaceholderSeries = (domain?: ChartDomain): ChartSeries[] => {
  let to = domain ? toTimestamp(domain.to) : Date.now();
  let from = domain ? toTimestamp(domain.from) : to - 12 * 60 * 60 * 1000;
  let step = Math.max((to - from) / (placeholderValues.length - 1), 1);

  return [
    {
      id: 'placeholder',
      name: 'Loading',
      entries: placeholderValues.map((value, i) => ({ key: from + step * i, value }))
    }
  ];
};
