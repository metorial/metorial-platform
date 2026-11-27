import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sandboxMachineUsageSummaryType } from '../../types';
import {
  presentSandboxUsageMetrics,
  sandboxUsageMetricFields,
  sandboxUsageRangeFields,
  sandboxUsageGroupFields
} from './machineUsageMetrics';

export let v1SandboxMachineUsageSummaryPresenter = Presenter.create(
  sandboxMachineUsageSummaryType
)
  .presenter(async ({ usage }) => ({
    object: 'sandbox.machine.usage.summary' as const,
    machine_id: usage.machineId,
    from: new Date(usage.summary.from),
    to: new Date(usage.summary.to),
    resolution: usage.summary.resolution,
    group_by: usage.groupBy,
    groups: usage.summary.groups.map(series => ({
      group: { machine_instance_id: series.group.instanceId ?? null },
      other: series.other,
      totals: presentSandboxUsageMetrics(series.totals)
    }))
  }))
  .schema(
    v.object({
      object: v.literal('sandbox.machine.usage.summary', {
        description: "String representing the object's type."
      }),
      ...sandboxUsageRangeFields,
      groups: v.array(
        v.object({
          ...sandboxUsageGroupFields,
          totals: v.object(sandboxUsageMetricFields, {
            description:
              'Usage totals and averages for the effective range. Averages use the full range duration.'
          })
        }),
        {
          description:
            'Usage groups ordered by CPU consumption, with the overflow group last. Empty when no observations exist.'
        }
      )
    })
  )
  .build();
