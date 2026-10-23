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
  getStackedMax,
  getTimeSpan,
  getValueBounds
} from './series';
import { formatTimeTick, toTimestamp } from './time';

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
  stacked?: boolean;
  formatTick: ValueFormatter;
  onRendered?: () => void;
};

let getYScale = (input: TimelineOptionsInput) => {
  let bounds = getValueBounds(input.series, input.referenceLines);
  let max = input.stacked ? getStackedMax(input.series) : bounds.max;
  let upper = Math.max(max, bounds.capacityMax * capacityHeadroom);

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

let axisLabelStyle = { colors: String(theme.colors.gray600) };

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
  let { series, xAxis, domain, sparkline, formatTick } = input;

  let colors = resolveSeriesColors(series);
  let spanMs = xAxis == 'time' ? getTimeSpan(series, domain) : 0;
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
      animations: { enabled: false },
      ...(input.onRendered
        ? { events: { mounted: input.onRendered, updated: input.onRendered } }
        : {})
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

    markers: { size: 0, hover: { size: 0 } },

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
              style: axisLabelStyle,
              datetimeUTC: false,
              formatter: (value, timestamp) =>
                formatTimeTick(timestamp ?? Number(value), spanMs)
            },
            tooltip: { enabled: false },
            crosshairs: { show: false }
          }
        : {
            type: 'category',
            labels: { show: !sparkline, style: axisLabelStyle },
            axisBorder: { show: !sparkline },
            axisTicks: { show: !sparkline },
            tooltip: { enabled: false },
            crosshairs: { show: false }
          },

    yaxis: {
      show: !sparkline,
      min: yScale.min,
      max: yScale.max,
      tickAmount: yScale.tickAmount,
      forceNiceScale: false,
      labels: {
        show: !sparkline,
        style: axisLabelStyle,
        formatter: value => formatTick(value)
      }
    },

    annotations: {
      yaxis: getReferenceAnnotations(input.referenceLines)
    },

    tooltip: { enabled: false },
    states: { hover: { filter: { type: 'none' } } }
  };
};

export let buildTimelineBarOptions = (input: TimelineOptionsInput): ApexOptions => {
  let base = buildTimelineOptions(input);

  return {
    ...base,

    chart: {
      ...base.chart,
      type: 'bar',
      stacked: !!input.stacked
    },

    plotOptions: {
      bar: {
        columnWidth: '80%',
        borderRadius: 2,
        borderRadiusApplication: 'end',
        borderRadiusWhenStacked: 'last'
      }
    },

    states: {
      hover: { filter: { type: 'none' } },
      active: { filter: { type: 'none' } }
    },

    fill: { type: 'solid', opacity: 1 },
    stroke: { width: 0 }
  };
};
