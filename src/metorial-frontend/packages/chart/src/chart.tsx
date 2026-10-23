import type ApexCharts from 'apexcharts';
import type { ApexOptions } from 'apexcharts';
import React, { memo, useMemo, useRef } from 'react';
import ReactApexChart from 'react-apexcharts';
import { chartPalette, getChartColor } from './colors';
import { ChartFrame } from './frame';
import type { ValueFormatter } from './format';
import { useStableFormatters } from './hooks';
import {
  ChartHoverLayer,
  type ChartSelection,
  type ChartSelectionRange,
  type TimelineBarClick
} from './hover';
import {
  buildTimelineBarOptions,
  buildTimelineOptions,
  getTickCountForHeight,
  toApexSeries
} from './options';
import {
  ChartDomain,
  ChartReferenceLine,
  ChartSeries,
  ChartXAxis,
  fillTimeBuckets,
  getPlaceholderBarSeries,
  getPlaceholderSeries,
  getSmallestTimeStep,
  hasChartData
} from './series';

export type { ChartSelection, ChartSelectionRange, TimelineBarClick };

export type ChartType = 'line' | 'bar' | 'bar-vertical' | 'bar-horizontal' | 'pie';

export type ChartProps = {
  series: ChartSeries[];
  type?: ChartType;
  height?: number;
  xAxis?: ChartXAxis;
  domain?: ChartDomain;
  valueFormatter?: ValueFormatter;
  tickFormatter?: ValueFormatter;
  yMin?: number;
  yMax?: number;
  yTickCount?: number;
  binaryScale?: boolean;
  referenceLines?: ChartReferenceLine[];
  legend?: boolean;
  tooltip?: boolean;
  tooltipTotalLabel?: string;
  clickHint?: string;
  intervalMs?: number;
  selection?: ChartSelection;
  stacked?: boolean;
  onBarClick?: (click: TimelineBarClick) => void;
  loading?: boolean;
  error?: React.ReactNode;
  emptyText?: React.ReactNode;
};

let TimelineChart = ({
  variant = 'line',
  series: rawSeries,
  height,
  xAxis,
  domain,
  yMin,
  yMax,
  yTickCount,
  binaryScale,
  referenceLines,
  legend,
  tooltip,
  tooltipTotalLabel,
  clickHint,
  intervalMs,
  selection,
  stacked,
  onBarClick,
  formatValue,
  formatTick
}: Omit<ChartProps, 'type' | 'height' | 'valueFormatter' | 'tickFormatter'> & {
  variant?: 'line' | 'bar';
  height: number;
  formatValue: ValueFormatter;
  formatTick: ValueFormatter;
}) => {
  let axis = xAxis ?? 'time';
  let lines = referenceLines ?? [];
  let chartRef = useRef<ApexCharts | null>(null);
  let renderedRef = useRef<(() => void) | undefined>(undefined);

  let rawKey = JSON.stringify(rawSeries);
  let domainFrom = domain ? new Date(domain.from).getTime() : undefined;
  let domainTo = domain ? new Date(domain.to).getTime() : undefined;

  let series = useMemo(
    () =>
      variant == 'bar' && axis == 'time'
        ? fillTimeBuckets(rawSeries, intervalMs ?? getSmallestTimeStep(rawSeries), domain)
        : rawSeries,
    [rawKey, variant, axis, intervalMs, domainFrom, domainTo]
  );

  let seriesKey = JSON.stringify(series);
  let linesKey = JSON.stringify(lines);
  let apexSeries = useMemo(() => toApexSeries(series, axis), [seriesKey, axis]);

  let options = useMemo(() => {
    let input = {
      series,
      xAxis: axis,
      domain,
      yMin,
      yMax,
      tickCount: yTickCount ?? getTickCountForHeight(height),
      binaryScale,
      referenceLines: lines,
      legend,
      stacked,
      formatTick,
      onRendered: () => renderedRef.current?.()
    };

    return variant == 'bar' ? buildTimelineBarOptions(input) : buildTimelineOptions(input);
  }, [
    variant,
    stacked,
    seriesKey,
    linesKey,
    axis,
    domainFrom,
    domainTo,
    yMin,
    yMax,
    yTickCount,
    height,
    binaryScale,
    legend,
    formatTick
  ]);

  let chart = useMemo(
    () => (
      <ReactApexChart
        key={variant}
        chartRef={chartRef}
        options={options}
        series={apexSeries}
        type={variant == 'bar' ? 'bar' : 'area'}
        height={height}
      />
    ),
    [variant, options, apexSeries, height]
  );

  if (tooltip === false) return chart;

  return (
    <ChartHoverLayer
      chart={chartRef}
      series={series}
      xAxis={axis}
      variant="card"
      mode={variant}
      stacked={stacked}
      intervalMs={intervalMs}
      totalLabel={tooltipTotalLabel}
      clickHint={clickHint}
      formatValue={formatValue}
      onBarClick={onBarClick}
      selection={selection}
      renderedRef={renderedRef}
    >
      {chart}
    </ChartHoverLayer>
  );
};

let LegacyChart = ({
  series: rawSeries,
  type,
  height,
  formatValue
}: {
  series: ChartSeries[];
  type: 'bar-vertical' | 'bar-horizontal' | 'pie';
  height: number;
  formatValue: ValueFormatter;
}) => {
  let colors = useMemo(() => chartPalette.map(getChartColor), []);

  let series = useMemo(() => {
    if (type == 'pie') return rawSeries.flatMap(item => item.entries.map(e => e.value ?? 0));

    return rawSeries.map(item => ({
      name: item.name,
      data: item.entries.map(entry => entry.value ?? 0)
    }));
  }, [rawSeries, type]);

  let options = useMemo(
    () =>
      ({
        colors,
        chart: {
          type: type == 'pie' ? 'pie' : 'bar',
          zoom: { enabled: false },
          toolbar: { show: false },
          animations: { enabled: false }
        },
        dataLabels: { enabled: false },

        labels:
          type == 'pie'
            ? rawSeries.flatMap(item => item.entries.map(entry => String(entry.key)))
            : [],

        plotOptions: {
          bar: {
            borderRadius: 4,
            borderRadiusApplication: 'end',
            horizontal: type == 'bar-horizontal'
          }
        },

        fill:
          type == 'pie'
            ? {}
            : {
                type: 'gradient',
                gradient: {
                  gradientToColors: colors,
                  shadeIntensity: 0,
                  inverseColors: false,
                  opacityFrom: 0.5,
                  opacityTo: 0.05,
                  stops: [0, 90, 100]
                }
              },

        stroke: { width: 2 },
        yaxis: { title: { text: undefined } },
        xaxis:
          type == 'pie'
            ? {}
            : { categories: rawSeries[0]?.entries.map(entry => String(entry.key)) ?? [] },
        tooltip: { y: { formatter: (value: number) => formatValue(value) } }
      }) satisfies ApexOptions,
    [type, rawSeries, colors, formatValue]
  );

  return (
    <ReactApexChart
      options={options}
      series={series}
      type={type == 'pie' ? 'pie' : 'bar'}
      height={height}
    />
  );
};

export let Chart = memo(
  ({
    type = 'line',
    height = 300,
    series,
    domain,
    valueFormatter,
    tickFormatter,
    loading,
    error,
    emptyText,
    ...rest
  }: ChartProps) => {
    let { formatValue, formatTick } = useStableFormatters(valueFormatter, tickFormatter);
    let isEmpty = !hasChartData(series);

    let placeholder = useMemo(() => {
      if (!loading || !isEmpty) return null;

      if (type == 'bar') {
        let bars = getPlaceholderBarSeries(domain);
        return (
          <TimelineChart
            variant="bar"
            series={bars.series}
            intervalMs={bars.intervalMs}
            height={height}
            xAxis="time"
            domain={domain}
            tooltip={false}
            formatValue={formatValue}
            formatTick={formatTick}
          />
        );
      }

      if (type == 'line') {
        return (
          <TimelineChart
            series={getPlaceholderSeries(domain)}
            height={height}
            xAxis="time"
            domain={domain}
            tooltip={false}
            formatValue={formatValue}
            formatTick={formatTick}
          />
        );
      }

      return null;
    }, [type, loading, isEmpty, height, domain?.from, domain?.to]);

    return (
      <ChartFrame
        height={height}
        loading={loading}
        isEmpty={isEmpty}
        error={error}
        emptyText={emptyText ?? (type == 'line' || type == 'bar' ? undefined : 'No data.')}
        placeholder={placeholder}
      >
        {type == 'line' || type == 'bar' ? (
          <TimelineChart
            {...rest}
            variant={type}
            series={series}
            domain={domain}
            height={height}
            formatValue={formatValue}
            formatTick={formatTick}
          />
        ) : (
          <LegacyChart series={series} type={type} height={height} formatValue={formatValue} />
        )}
      </ChartFrame>
    );
  }
);
