import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxMachinesUsageSummaryOutput = {
  object: 'sandbox.machine.usage.summary';
  machineId: string;
  from: Date;
  to: Date;
  resolution: 'minute' | 'hour';
  groupBy: 'machine_instance'[];
  groups: {
    group: { machineInstanceId: string | null };
    other: boolean;
    totals: {
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
    };
  }[];
};

export let mapManagementInstanceSandboxMachinesUsageSummaryOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxMachinesUsageSummaryOutput>(
    [
      'machine_id',
      ['from', 0, 4],
      ['to', 0, 4],
      'group_by',
      [
        'groups',
        0,
        [
          2,
          [
            1,
            [
              ['group', 0, [1, ['machine_instance_id']]],
              [
                'totals',
                0,
                [
                  1,
                  [
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
  );

export type ManagementInstanceSandboxMachinesUsageSummaryQuery = {
  from: Date;
  to: Date;
  machineInstanceId?: string | string[] | undefined;
  groupBy?: 'machine_instance' | undefined;
  maxSeries?: number | undefined;
};

export let mapManagementInstanceSandboxMachinesUsageSummaryQuery =
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxMachinesUsageSummaryQuery>(
    [
      ['from', 0, 4],
      ['to', 0, 4],
      'machine_instance_id',
      'group_by',
      'max_series'
    ]
  );
