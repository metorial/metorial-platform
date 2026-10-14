import { describe, expect, it } from 'vitest';
import { v1SandboxMachineUsageTimelinePresenter } from './machineUsageTimeline';
import { v1SandboxMachineUsageSummaryPresenter } from './machineUsageSummary';
import { v1SandboxMachineUsagePresenter } from './machineUsage';

let context = { apiVersion: 'mt_2026_01_01_magnetar', accessType: 'instance_secret' } as const;

let totals = {
  samples: 15,
  runtimeSeconds: 30,
  cpuCoreSeconds: 12,
  avgCores: 0.2,
  cpuPercent: 40,
  peakCores: 1.5,
  memByteSeconds: 6000,
  avgMemBytes: 100,
  peakMemBytes: 400,
  allocatedMemByteSeconds: 12000,
  avgAllocatedMemBytes: 200,
  netRxBytes: 111,
  netTxBytes: 222,
  diskReadBytes: 333,
  diskWriteBytes: 444
};

let expectedMetrics = {
  samples: 15,
  runtime_seconds: 30,
  cpu_core_seconds: 12,
  average_cores_used: 0.2,
  cpu_percent: 40,
  peak_cores_used: 1.5,
  memory_byte_seconds: 6000,
  average_memory_used_bytes: 100,
  peak_memory_used_bytes: 400,
  allocated_memory_byte_seconds: 12000,
  average_memory_allocated_bytes: 200,
  network_rx_bytes: 111,
  network_tx_bytes: 222,
  disk_read_bytes: 333,
  disk_write_bytes: 444
};

let from = Date.parse('2026-01-01T00:00:00Z');

let zero = Object.fromEntries(Object.keys(totals).map(key => [key, 0])) as typeof totals;

describe('sandbox machine usage history presenters', () => {
  it('maps all metrics and effective bounds without recalculating weighted values or changing series order', async () => {
    let result = await v1SandboxMachineUsageTimelinePresenter
      .present(
        {
          usage: {
            machineId: 'sbm_1',
            groupBy: ['machine_instance'],
            timeline: {
              from,
              to: from + 120_000,
              interval: '1m',
              resolution: 'minute',
              series: [
                {
                  group: { instanceId: 'run_1' },
                  other: false,
                  points: [
                    { t: from, ...totals },
                    { t: from + 60_000, ...zero }
                  ]
                },
                { group: {}, other: true, points: [{ t: from, ...totals }] }
              ]
            }
          }
        },
        context
      )
      .run();

    expect(result).toMatchObject({
      object: 'sandbox.machine.usage.timeline',
      machine_id: 'sbm_1',
      from: new Date(from),
      to: new Date(from + 120_000),
      interval: '1m',
      resolution: 'minute',
      group_by: ['machine_instance']
    });
    expect(result.series[0]!.points[0]).toEqual({
      timestamp: new Date(from),
      ...expectedMetrics
    });
    expect(result.series[0]!.points[1]).toEqual({
      timestamp: new Date(from + 60_000),
      ...Object.fromEntries(Object.keys(expectedMetrics).map(key => [key, 0]))
    });
    expect(
      result.series.map(series => [series.group.machine_instance_id, series.other])
    ).toEqual([
      ['run_1', false],
      [null, true]
    ]);
    expect(v1SandboxMachineUsageTimelinePresenter.schema.validate(result).success).toBe(true);
  });

  it('presents summary totals with its independent source resolution and effective bounds', async () => {
    let result = await v1SandboxMachineUsageSummaryPresenter
      .present(
        {
          usage: {
            machineId: 'sbm_1',
            groupBy: [],
            summary: {
              from,
              to: from + 3_600_000,
              resolution: 'hour',
              groups: [{ group: {}, other: false, totals }]
            }
          }
        },
        context
      )
      .run();

    expect(result).toEqual({
      object: 'sandbox.machine.usage.summary',
      machine_id: 'sbm_1',
      from: new Date(from),
      to: new Date(from + 3_600_000),
      resolution: 'hour',
      group_by: [],
      groups: [{ group: { machine_instance_id: null }, other: false, totals: expectedMetrics }]
    });
    expect(v1SandboxMachineUsageSummaryPresenter.schema.validate(result).success).toBe(true);
  });

  it('preserves empty history without synthesizing observations', async () => {
    let timeline = await v1SandboxMachineUsageTimelinePresenter
      .present(
        {
          usage: {
            machineId: 'sbm_1',
            groupBy: [],
            timeline: {
              from,
              to: from + 60_000,
              interval: '1m',
              resolution: 'minute',
              series: []
            }
          }
        },
        context
      )
      .run();
    let summary = await v1SandboxMachineUsageSummaryPresenter
      .present(
        {
          usage: {
            machineId: 'sbm_1',
            groupBy: [],
            summary: { from, to: from + 60_000, resolution: 'minute', groups: [] }
          }
        },
        context
      )
      .run();

    expect(timeline.series).toEqual([]);
    expect(summary.groups).toEqual([]);
  });

  it('keeps raw sample fields and cumulative byte counters unchanged', async () => {
    let result = await v1SandboxMachineUsagePresenter
      .present(
        {
          sample: {
            id: 'sample_1',
            instanceId: 'run_1',
            t: from,
            cpuPercent: 25,
            coresUsed: 0.5,
            coresAvailable: 2,
            memUsedBytes: 100,
            memTotalBytes: 200,
            netRxBytes: 10000,
            netTxBytes: 20000,
            diskReadBytes: 30000,
            diskWriteBytes: 40000
          } as any
        },
        context
      )
      .run();

    expect(result).toEqual({
      object: 'sandbox.machine.usage',
      id: 'sample_1',
      machine_instance_id: 'run_1',
      timestamp: new Date(from),
      cpu_percent: 25,
      cores_used: 0.5,
      cores_available: 2,
      memory_used_bytes: 100,
      memory_total_bytes: 200,
      network_rx_bytes: 10000,
      network_tx_bytes: 20000,
      disk_read_bytes: 30000,
      disk_write_bytes: 40000
    });
  });
});
