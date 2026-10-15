import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sandboxMachineUsageType } from '../../types';

export let v1SandboxMachineUsagePresenter = Presenter.create(sandboxMachineUsageType)
  .presenter(async ({ sample }) => ({
    object: 'sandbox.machine.usage' as const,

    id: sample.id,
    machine_instance_id: sample.instanceId,
    timestamp: new Date(sample.t),

    cpu_percent: sample.cpuPercent,
    cores_used: sample.coresUsed,
    cores_available: sample.coresAvailable,
    memory_used_bytes: sample.memUsedBytes,
    memory_total_bytes: sample.memTotalBytes,
    network_rx_bytes: sample.netRxBytes,
    network_tx_bytes: sample.netTxBytes,
    disk_read_bytes: sample.diskReadBytes,
    disk_write_bytes: sample.diskWriteBytes
  }))
  .schema(
    v.object({
      object: v.literal('sandbox.machine.usage', {
        description: "String representing the object's type"
      }),

      id: v.string({ description: "The sample's unique identifier" }),
      machine_instance_id: v.string({ description: 'The instance the sample was taken from' }),
      timestamp: v.date({ description: 'When the sample was taken' }),

      cpu_percent: v.number({ description: 'CPU utilization across all cores, in percent' }),
      cores_used: v.number({ description: 'The number of cores in use' }),
      cores_available: v.number({ description: 'The number of cores available' }),
      memory_used_bytes: v.number({ description: 'Memory in use, in bytes' }),
      memory_total_bytes: v.number({ description: 'Total memory, in bytes' }),
      network_rx_bytes: v.number({ description: 'Total bytes received over the network' }),
      network_tx_bytes: v.number({ description: 'Total bytes sent over the network' }),
      disk_read_bytes: v.number({ description: 'Total bytes read from disk' }),
      disk_write_bytes: v.number({ description: 'Total bytes written to disk' })
    })
  )
  .build();
