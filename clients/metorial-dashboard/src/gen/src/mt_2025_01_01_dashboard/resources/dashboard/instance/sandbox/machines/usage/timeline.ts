import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSandboxMachinesUsageTimelineOutput = {
  object: 'sandbox.machine.usage.timeline';
  machineId: string;
  from: Date;
  to: Date;
  resolution: 'minute' | 'hour';
  groupBy: 'machine_instance'[];
  interval: '1m' | '5m' | '15m' | '30m' | '1h' | '6h' | '12h' | '1d';
  series: {
    group: { machineInstanceId: string | null };
    other: boolean;
    points: {
      timestamp: Date;
      samples: number;
      runtimeSeconds: number;
      cpuCoreSeconds: number;
      averageCoresUsed: number;
      cpuPercent: number;
      peakCoresUsed: number;
      memoryByteSeconds: number;
      averageMemoryUsedBytes: number;
      peakMemoryUsedBytes: number;
      allocatedMemoryByteSeconds: number;
      averageMemoryAllocatedBytes: number;
      networkRxBytes: number;
      networkTxBytes: number;
      diskReadBytes: number;
      diskWriteBytes: number;
    }[];
  }[];
};

export let mapDashboardInstanceSandboxMachinesUsageTimelineOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSandboxMachinesUsageTimelineOutput>(
    [
      'machine_id',
      ['from', 0, 4],
      ['to', 0, 4],
      'group_by',
      [
        'series',
        0,
        [
          2,
          [
            1,
            [
              ['group', 0, [1, ['machine_instance_id']]],
              [
                'points',
                0,
                [
                  2,
                  [
                    1,
                    [
                      ['timestamp', 0, 4],
                      'runtime_seconds',
                      'cpu_core_seconds',
                      'average_cores_used',
                      'cpu_percent',
                      'peak_cores_used',
                      'memory_byte_seconds',
                      'average_memory_used_bytes',
                      'peak_memory_used_bytes',
                      'allocated_memory_byte_seconds',
                      'average_memory_allocated_bytes',
                      'network_rx_bytes',
                      'network_tx_bytes',
                      'disk_read_bytes',
                      'disk_write_bytes'
                    ]
                  ]
                ]
              ]
            ]
          ]
        ]
      ]
    ]
  );

export type DashboardInstanceSandboxMachinesUsageTimelineQuery = {
  from: Date;
  to: Date;
  machineInstanceId?: string | string[] | undefined;
  groupBy?: 'machine_instance' | undefined;
  maxSeries?: number | undefined;
  interval?:
    | '1m'
    | '5m'
    | '15m'
    | '30m'
    | '1h'
    | '6h'
    | '12h'
    | '1d'
    | undefined;
};

export let mapDashboardInstanceSandboxMachinesUsageTimelineQuery =
  /* @__PURE__ */ mapObject<DashboardInstanceSandboxMachinesUsageTimelineQuery>(
    [
      ['from', 0, 4],
      ['to', 0, 4],
      'machine_instance_id',
      'group_by',
      'max_series'
    ]
  );
