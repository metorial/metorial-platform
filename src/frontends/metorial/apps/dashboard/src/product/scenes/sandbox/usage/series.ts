import type { ChartSeries } from '@metorial/chart';
import type { DashboardInstanceSandboxMachinesUsageTimelineOutput } from '@metorial/state';

type Point =
  DashboardInstanceSandboxMachinesUsageTimelineOutput['series'][number]['points'][number];

export let sandboxUsageChartSeries = (
  timeline: Pick<DashboardInstanceSandboxMachinesUsageTimelineOutput, 'series'>,
  cpus: number | null
) => {
  let points = timeline.series
    .flatMap(series => series.points)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  let series = (
    id: string,
    name: string,
    value: (point: Point) => number,
    dashed = false
  ): ChartSeries => ({
    id,
    name,
    style: dashed ? 'dashed' : 'line',
    entries: points.map(point => ({
      key: point.timestamp,
      value: point.samples > 0 ? value(point) : null
    }))
  });

  return {
    cpu: [
      series('used', 'Used', p => p.averageCoresUsed),
      ...(cpus === null ? [] : [series('allocated', 'Allocated', () => cpus, true)])
    ],
    memory: [
      series('used', 'Used', p => p.averageMemoryUsedBytes),
      series('allocated', 'Allocated', p => p.averageMemoryAllocatedBytes, true)
    ],
    network: [
      series('in', 'In', p => p.networkRxBytes),
      series('out', 'Out', p => p.networkTxBytes)
    ],
    disk: [
      series('read', 'Read', p => p.diskReadBytes),
      series('write', 'Write', p => p.diskWriteBytes)
    ]
  };
};
