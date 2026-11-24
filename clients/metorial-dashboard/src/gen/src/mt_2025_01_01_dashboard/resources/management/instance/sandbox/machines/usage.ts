import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxMachinesUsageOutput = {
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

export let mapManagementInstanceSandboxMachinesUsageOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceSandboxMachinesUsageOutput>([
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

export type ManagementInstanceSandboxMachinesUsageQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { machineInstanceId?: string | string[] | undefined };

export let mapManagementInstanceSandboxMachinesUsageQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceSandboxMachinesUsageQuery>([
    3,
    [[0, [1, ['machine_instance_id']]]]
  ]);
