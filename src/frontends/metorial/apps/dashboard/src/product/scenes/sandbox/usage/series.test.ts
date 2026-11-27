import { describe, expect, it } from 'vitest';
import type { DashboardInstanceSandboxMachinesUsageTimelineOutput } from '@metorial/state';
import { sandboxUsageChartSeries } from './series';

describe('sandboxUsageChartSeries', () => {
  it('sorts buckets, preserves missing samples as gaps, and draws allocation separately', () => {
    let points = [
      { timestamp: new Date('2026-10-14T12:01:00Z'), samples: 0, averageCoresUsed: 0 },
      {
        timestamp: new Date('2026-10-14T12:00:00Z'),
        samples: 1,
        averageCoresUsed: 1.5,
        averageMemoryUsedBytes: 100,
        averageMemoryAllocatedBytes: 200,
        networkRxBytes: 10,
        networkTxBytes: 20,
        diskReadBytes: 30,
        diskWriteBytes: 40
      }
    ] as DashboardInstanceSandboxMachinesUsageTimelineOutput['series'][number]['points'];
    let result = sandboxUsageChartSeries(
      { series: [{ group: { machineInstanceId: null }, other: false, points }] },
      2
    );

    expect(result.cpu[0].entries.map(p => p.value)).toEqual([1.5, null]);
    expect(result.cpu[1].style).toBe('dashed');
    expect(result.cpu[1].entries.map(p => p.value)).toEqual([2, null]);
    expect(result.memory[1].entries[0].value).toBe(200);
    expect(result.network.map(s => s.entries[0].value)).toEqual([10, 20]);
    expect(result.disk.map(s => s.entries[0].value)).toEqual([30, 40]);
    expect(points[0].timestamp.toISOString()).toContain('12:01');
  });

  it('handles no samples and unavailable specs', () => {
    expect(sandboxUsageChartSeries({ series: [] }, null).cpu).toHaveLength(1);
    expect(sandboxUsageChartSeries({ series: [] }, null).memory[0].entries).toEqual([]);
  });
});
