import { v } from '@lowerdeck/validation';
import type { sandboxMachineUsageService } from '@metorial/module-sandbox';

type UsageTotals = Awaited<
  ReturnType<typeof sandboxMachineUsageService.summary>
>['summary']['groups'][number]['totals'];

export let presentSandboxUsageMetrics = (totals: UsageTotals) => ({
  samples: totals.samples,
  runtime_seconds: totals.runtimeSeconds,

  cpu_core_seconds: totals.cpuCoreSeconds,
  average_cores_used: totals.avgCores,
  cpu_percent: totals.cpuPercent,
  peak_cores_used: totals.peakCores,

  memory_byte_seconds: totals.memByteSeconds,
  average_memory_used_bytes: totals.avgMemBytes,
  peak_memory_used_bytes: totals.peakMemBytes,
  allocated_memory_byte_seconds: totals.allocatedMemByteSeconds,
  average_memory_allocated_bytes: totals.avgAllocatedMemBytes,

  network_rx_bytes: totals.netRxBytes,
  network_tx_bytes: totals.netTxBytes,

  disk_read_bytes: totals.diskReadBytes,
  disk_write_bytes: totals.diskWriteBytes
});

export let sandboxUsageMetricFields = {
  samples: v.number({
    description:
      'Number of observations. Zero means no telemetry was observed, not necessarily that the machine was stopped.'
  }),
  runtime_seconds: v.number({
    description: 'Observed runtime in seconds, not billable runtime.'
  }),

  cpu_core_seconds: v.number({
    description: 'CPU consumed in core seconds during the bucket or range.'
  }),
  average_cores_used: v.number({
    description: 'CPU core seconds divided by the full bucket or range duration in seconds.'
  }),
  cpu_percent: v.number({
    description: 'CPU consumed as a percentage of observed allocated CPU capacity.'
  }),
  peak_cores_used: v.number({ description: 'Highest sampled number of cores in use.' }),

  memory_byte_seconds: v.number({
    description: 'Time-integrated used memory in byte seconds.'
  }),
  average_memory_used_bytes: v.number({
    description: 'Used memory in bytes averaged over the full bucket or range duration.'
  }),
  peak_memory_used_bytes: v.number({ description: 'Highest sampled memory usage in bytes.' }),
  allocated_memory_byte_seconds: v.number({
    description: 'Time-integrated allocated memory in byte seconds.'
  }),
  average_memory_allocated_bytes: v.number({
    description: 'Allocated memory in bytes averaged over the full bucket or range duration.'
  }),

  network_rx_bytes: v.number({
    description: 'Bytes received during the bucket or range; not a cumulative counter.'
  }),
  network_tx_bytes: v.number({
    description: 'Bytes sent during the bucket or range; not a cumulative counter.'
  }),

  disk_read_bytes: v.number({
    description: 'Bytes read from disk during the bucket or range; not a cumulative counter.'
  }),
  disk_write_bytes: v.number({
    description: 'Bytes written to disk during the bucket or range; not a cumulative counter.'
  })
};

export let sandboxUsageRangeFields = {
  machine_id: v.string({ description: 'The machine whose resource usage is reported.' }),
  from: v.date({
    description:
      'Effective inclusive range start, clamped to retention and rounded down to a UTC bucket boundary.'
  }),
  to: v.date({
    description: 'Effective exclusive range end, rounded up to a UTC bucket boundary.'
  }),
  resolution: v.enumOf(['minute', 'hour'], {
    description:
      'Resolution of the retained source data, independently of the timeline interval.'
  }),
  group_by: v.array(v.literal('machine_instance'), {
    description: 'Grouping dimensions. Empty means usage is aggregated across the machine.'
  })
};

export let sandboxUsageGroupFields = {
  group: v.object(
    {
      machine_instance_id: v.nullable(
        v.string({
          description:
            'Execution identifier, or null for an ungrouped aggregate or the overflow group.'
        })
      )
    },
    { description: 'Dimensions identifying this group.' }
  ),
  other: v.boolean({
    description:
      'Whether this group combines executions outside the top max_series groups, ranked by CPU consumption.'
  })
};
