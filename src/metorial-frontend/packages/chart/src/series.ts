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
