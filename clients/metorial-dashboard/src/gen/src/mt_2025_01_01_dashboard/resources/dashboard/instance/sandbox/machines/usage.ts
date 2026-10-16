import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSandboxMachinesUsageOutput = {
  items: {
    object: 'sandbox.machine.usage';
    id: string;
    machineInstanceId: string;
    timestamp: Date;
    cpuPercent: number;
    coresUsed: number;
    coresAvailable: number;
    memoryUsedBytes: number;
    memoryTotalBytes: number;
    networkRxBytes: number;
    networkTxBytes: number;
    diskReadBytes: number;
    diskWriteBytes: number;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSandboxMachinesUsageOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceSandboxMachinesUsageOutput>([
    7,
    [
      1,
      [
        'machine_instance_id',
        ['timestamp', 0, 4],
        'cpu_percent',
        'cores_used',
        'cores_available',
        'memory_used_bytes',
        'memory_total_bytes',
        'network_rx_bytes',
        'network_tx_bytes',
        'disk_read_bytes',
        'disk_write_bytes'
      ]
    ]
  ]);

export type DashboardInstanceSandboxMachinesUsageQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { machineInstanceId?: string | string[] | undefined };

export let mapDashboardInstanceSandboxMachinesUsageQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceSandboxMachinesUsageQuery>([
    3,
    [[0, [1, ['machine_instance_id']]]]
  ]);
