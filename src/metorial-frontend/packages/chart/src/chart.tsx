import type { ApexOptions } from 'apexcharts';
import React, { memo, useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';
import { chartPalette, getChartColor } from './colors';
import { ChartFrame } from './frame';
import type { ValueFormatter } from './format';
import { useStableFormatters } from './hooks';
import { buildTimelineOptions, getTickCountForHeight, toApexSeries } from './options';
import {
  ChartDomain,
  ChartReferenceLine,
  ChartSeries,
  ChartXAxis,
  getPlaceholderSeries,
  hasChartData
} from './series';

export type ChartType = 'line' | 'bar-vertical' | 'bar-horizontal' | 'pie';

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
  loading?: boolean;
  error?: React.ReactNode;
  emptyText?: React.ReactNode;
};

let TimelineChart = ({
  series,
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
  formatValue,
  formatTick
}: Omit<ChartProps, 'type' | 'height' | 'valueFormatter' | 'tickFormatter'> & {
  height: number;
  formatValue: ValueFormatter;
  formatTick: ValueFormatter;
}) => {
  let axis = xAxis ?? 'time';
  let lines = referenceLines ?? [];

  let seriesKey = JSON.stringify(series);
  let linesKey = JSON.stringify(lines);
  let domainFrom = domain ? new Date(domain.from).getTime() : undefined;
  let domainTo = domain ? new Date(domain.to).getTime() : undefined;

  let apexSeries = useMemo(() => toApexSeries(series, axis), [seriesKey, axis]);

  let options = useMemo(
    () =>
      buildTimelineOptions({
        series,
        xAxis: axis,
        domain,
        yMin,
        yMax,
        tickCount: yTickCount ?? getTickCountForHeight(height),
        binaryScale,
        referenceLines: lines,
        legend,
        tooltip: tooltip ?? true,
        formatValue,
        formatTick
      }),
    [
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
      tooltip,
      formatValue,
      formatTick
    ]
  );

  return <ReactApexChart options={options} series={apexSeries} type="area" height={height} />;
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
        xaxis: type == 'pie' ? {} : { categories: ['Submissions'] },
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

    let placeholder = useMemo(
      () =>
        type == 'line' && loading && isEmpty ? (
          <TimelineChart
            series={getPlaceholderSeries(domain)}
            height={height}
            xAxis="time"
            domain={domain}
            tooltip={false}
            formatValue={formatValue}
            formatTick={formatTick}
          />
        ) : null,
      [type, loading, isEmpty, height, domain?.from, domain?.to]
    );

    return (
      <ChartFrame
        height={height}
        loading={loading}
        isEmpty={isEmpty}
        error={error}
        emptyText={emptyText ?? (type == 'line' ? undefined : 'No data.')}
        placeholder={placeholder}
      >
        {type == 'line' ? (
          <TimelineChart
            {...rest}
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
