import { theme } from '@metorial/ui';
import type ApexCharts from 'apexcharts';
import React, { memo, useMemo, useRef } from 'react';
import ReactApexChart from 'react-apexcharts';
import type { ValueFormatter } from './format';
import { useStableFormatters } from './hooks';
import { ChartHoverLayer } from './hover';
import { buildTimelineOptions, toApexSeries } from './options';
import {
  ChartDomain,
  ChartReferenceLine,
  ChartSeries,
  ChartXAxis,
  hasChartData
} from './series';

export type SparklineProps = {
  series: ChartSeries[];
  height?: number;
  xAxis?: ChartXAxis;
  domain?: ChartDomain;
  valueFormatter?: ValueFormatter;
  yMin?: number;
  yMax?: number;
  binaryScale?: boolean;
  referenceLines?: ChartReferenceLine[];
  tooltip?: boolean;
};

let SparklineBaseline = ({ height }: { height: number }) => (
  <div style={{ position: 'relative', height }} aria-hidden>
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 1,
        borderBottom: `1.5px dashed ${theme.colors.gray400}`
      }}
    />
  </div>
);

export let Sparkline = memo(
  ({
    series,
    height = 40,
    xAxis = 'time',
    domain,
    valueFormatter,
    yMin,
    yMax,
    binaryScale,
    referenceLines,
    tooltip = false
  }: SparklineProps) => {
    let { formatValue, formatTick } = useStableFormatters(valueFormatter, undefined);
    let chartRef = useRef<ApexCharts | null>(null);

    let seriesKey = JSON.stringify(series);
    let linesKey = JSON.stringify(referenceLines ?? []);
    let domainFrom = domain ? new Date(domain.from).getTime() : undefined;
    let domainTo = domain ? new Date(domain.to).getTime() : undefined;

    let stableSeries = useMemo(() => series, [seriesKey]);
    let apexSeries = useMemo(() => toApexSeries(series, xAxis), [seriesKey, xAxis]);

    let options = useMemo(
      () =>
        buildTimelineOptions({
          series,
          xAxis,
          domain,
          yMin,
          yMax,
          tickCount: 2,
          binaryScale,
          referenceLines: referenceLines ?? [],
          sparkline: true,
          formatTick
        }),
      [seriesKey, linesKey, xAxis, domainFrom, domainTo, yMin, yMax, binaryScale]
    );

    if (!hasChartData(series)) return <SparklineBaseline height={height} />;

    let chart = (
      <ReactApexChart
        chartRef={chartRef}
        options={options}
        series={apexSeries}
        type="area"
        height={height}
      />
    );

    return (
      <div style={{ height, minWidth: 0 }}>
        {tooltip ? (
          <ChartHoverLayer
            chart={chartRef}
            series={stableSeries}
            xAxis={xAxis}
            variant="chip"
            mode="line"
            formatValue={formatValue}
          >
            {chart}
          </ChartHoverLayer>
        ) : (
          chart
        )}
      </div>
    );
  }
);
