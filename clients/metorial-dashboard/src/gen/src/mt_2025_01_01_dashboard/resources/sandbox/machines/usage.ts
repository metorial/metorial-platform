import { mtMap } from '@metorial/util-resource-mapper';

export type SandboxMachinesUsageOutput = {
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

export let mapSandboxMachinesUsageOutput =
  mtMap.object<SandboxMachinesUsageOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          machineInstanceId: mtMap.objectField(
            'machine_instance_id',
            mtMap.passthrough()
          ),
          timestamp: mtMap.objectField('timestamp', mtMap.date()),
          cpuPercent: mtMap.objectField('cpu_percent', mtMap.passthrough()),
          coresUsed: mtMap.objectField('cores_used', mtMap.passthrough()),
          coresAvailable: mtMap.objectField(
            'cores_available',
            mtMap.passthrough()
          ),
          memoryUsedBytes: mtMap.objectField(
            'memory_used_bytes',
            mtMap.passthrough()
          ),
          memoryTotalBytes: mtMap.objectField(
            'memory_total_bytes',
            mtMap.passthrough()
          ),
          networkRxBytes: mtMap.objectField(
            'network_rx_bytes',
            mtMap.passthrough()
          ),
          networkTxBytes: mtMap.objectField(
            'network_tx_bytes',
            mtMap.passthrough()
          ),
          diskReadBytes: mtMap.objectField(
            'disk_read_bytes',
            mtMap.passthrough()
          ),
          diskWriteBytes: mtMap.objectField(
            'disk_write_bytes',
            mtMap.passthrough()
          )
        })
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type SandboxMachinesUsageQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { machineInstanceId?: string | string[] | undefined };

export let mapSandboxMachinesUsageQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      machineInstanceId: mtMap.objectField(
        'machine_instance_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      )
    })
  )
]);

