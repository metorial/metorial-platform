import { theme } from '@metorial/ui';
import type { ApexOptions } from 'apexcharts';
import { getChartColor, resolveSeriesColors } from './colors';
import type { ValueFormatter } from './format';
import { getNiceScale } from './scale';
import {
  ChartDomain,
  ChartReferenceLine,
  ChartSeries,
  ChartXAxis,
  getSmallestTimeStep,
  getTimeSpan,
  getValueBounds
} from './series';
import { formatTimeTick, formatTooltipTime, toTimestamp } from './time';

let capacityHeadroom = 1.05;

export let toApexSeries = (series: ChartSeries[], xAxis: ChartXAxis) =>
  series.map(item => ({
    name: item.name,
    data: item.entries.map(entry => ({
      x: xAxis == 'time' ? toTimestamp(entry.key) : String(entry.key),
      y: entry.value
    }))
  }));

export let getTickCountForHeight = (height: number) =>
  Math.max(2, Math.min(5, Math.floor(height / 60)));

export type TimelineOptionsInput = {
  series: ChartSeries[];
  xAxis: ChartXAxis;
  domain?: ChartDomain;
  yMin?: number;
  yMax?: number;
  tickCount: number;
  binaryScale?: boolean;
  referenceLines: ChartReferenceLine[];
  legend?: boolean;
  sparkline?: boolean;
  tooltip: boolean;
  formatValue: ValueFormatter;
  formatTick: ValueFormatter;
};

let getYScale = (input: TimelineOptionsInput) => {
  let bounds = getValueBounds(input.series, input.referenceLines);
  let upper = Math.max(bounds.max, bounds.capacityMax * capacityHeadroom);

  let scale = getNiceScale(input.yMin ?? bounds.min, input.yMax ?? upper, {
    tickCount: input.tickCount,
    binary: input.binaryScale,
    includeZero: input.yMin === undefined
  });

  return {
    min: input.yMin ?? scale.min,
    max: input.yMax ?? scale.max,
    tickAmount: scale.tickAmount
  };
};

let getReferenceAnnotations = (referenceLines: ChartReferenceLine[]) =>
  referenceLines.map(line => ({
    y: line.value,
    borderColor: getChartColor(line.color ?? 'gray'),
    strokeDashArray: 5,
    label: line.label
      ? {
          text: line.label,
          borderWidth: 0,
          position: 'right',
          textAnchor: 'end',
          offsetY: -2,
          style: {
            background: 'transparent',
            color: String(theme.colors.gray700),
            fontSize: '11px',
            fontWeight: 500
          }
        }
      : undefined
  }));

export let buildTimelineOptions = (input: TimelineOptionsInput): ApexOptions => {
  let { series, xAxis, domain, sparkline, formatValue, formatTick } = input;

  let colors = resolveSeriesColors(series);
  let spanMs = xAxis == 'time' ? getTimeSpan(series, domain) : 0;
  let showSeconds = xAxis == 'time' && getSmallestTimeStep(series) < 60_000;
  let yScale = getYScale(input);

  let styles = series.map(item => item.style ?? 'area');

  return {
    colors,

    chart: {
      type: 'area',
      sparkline: { enabled: !!sparkline },
      parentHeightOffset: sparkline ? 0 : undefined,
      zoom: { enabled: false },
      toolbar: { show: false },
      animations: { enabled: false }
    },

    dataLabels: { enabled: false },
    legend: sparkline
      ? { show: false }
      : input.legend === undefined
        ? {}
        : { show: input.legend },

    fill: {
      type: 'gradient',
      gradient: {
        gradientToColors: colors,
        shadeIntensity: 0,
        inverseColors: false,
        opacityFrom: styles.map(style => (style == 'area' ? 0.5 : 0)),
        opacityTo: styles.map(style => (style == 'area' ? 0.05 : 0)),
        stops: [0, 90, 100]
      }
    },

    stroke: {
      width: styles.map(style => (style == 'dashed' || sparkline ? 1.5 : 2)),
      dashArray: styles.map(style => (style == 'dashed' ? 5 : 0)),
      curve: styles.map(style => (style == 'dashed' ? 'straight' : 'smooth'))
    },

    markers: {
      size: 0,
      hover: { size: sparkline ? 3 : 4 }
    },

    xaxis:
      xAxis == 'time'
        ? {
            type: 'datetime',
            axisBorder: { show: !sparkline },
            axisTicks: { show: !sparkline },
            min: domain ? toTimestamp(domain.from) : undefined,
            max: domain ? toTimestamp(domain.to) : undefined,
            labels: {
              show: !sparkline,
              datetimeUTC: false,
              formatter: (value, timestamp) =>
                formatTimeTick(timestamp ?? Number(value), spanMs)
            },
            tooltip: { enabled: false }
          }
        : {
            type: 'category',
            labels: { show: !sparkline },
            axisBorder: { show: !sparkline },
            axisTicks: { show: !sparkline },
            tooltip: { enabled: false }
          },

    yaxis: {
      show: !sparkline,
      min: yScale.min,
      max: yScale.max,
      tickAmount: yScale.tickAmount,
      forceNiceScale: false,
      labels: {
        show: !sparkline,
        formatter: value => formatTick(value)
      }
    },

    annotations: {
      yaxis: getReferenceAnnotations(input.referenceLines)
    },

    tooltip: {
      enabled: input.tooltip,
      shared: true,
      intersect: false,
      x: {
        show: true,
        formatter:
          xAxis == 'time'
            ? value => formatTooltipTime(value, { seconds: showSeconds })
            : undefined
      },
      y: {
        formatter: value =>
          value === null || value === undefined || !Number.isFinite(value)
            ? '—'
            : formatValue(value)
      },
      marker: { show: !sparkline }
    }
  };
};
