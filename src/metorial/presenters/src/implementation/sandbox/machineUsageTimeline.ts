import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sandboxMachineUsageTimelineType } from '../../types';
import {
  presentSandboxUsageMetrics,
  sandboxUsageMetricFields,
  sandboxUsageRangeFields,
  sandboxUsageGroupFields
} from './machineUsageMetrics';

export let v1SandboxMachineUsageTimelinePresenter = Presenter.create(
  sandboxMachineUsageTimelineType
)
  .presenter(async ({ usage }) => ({
    object: 'sandbox.machine.usage.timeline' as const,
    machine_id: usage.machineId,
    from: new Date(usage.timeline.from),
    to: new Date(usage.timeline.to),
    resolution: usage.timeline.resolution,
    group_by: usage.groupBy,
    interval: usage.timeline.interval,
    series: usage.timeline.series.map(series => ({
      group: { machine_instance_id: series.group.instanceId ?? null },
      other: series.other,
      points: series.points.map(point => ({
        timestamp: new Date(point.t),
        ...presentSandboxUsageMetrics(point)
      }))
    }))
  }))
  .schema(
    v.object({
      object: v.literal('sandbox.machine.usage.timeline', {
        description: "String representing the object's type."
      }),
      ...sandboxUsageRangeFields,
      interval: v.enumOf(['1m', '5m', '15m', '30m', '1h', '6h', '12h', '1d'], {
        description:
          'Effective bucket interval. Automatic selection targets about 500 points, with at most 1500 allowed.'
      }),
      series: v.array(
        v.object({
          ...sandboxUsageGroupFields,
          points: v.array(
            v.object({
              timestamp: v.date({
                description:
                  'Inclusive UTC bucket start. Points are chronological; missing buckets within a series contain zero metrics.'
              }),
              ...sandboxUsageMetricFields
            }),
            { description: 'Chronological usage buckets.' }
          )
        }),
        {
          description:
            'Usage groups ordered by CPU consumption, with the overflow group last. Empty when no observations exist.'
        }
      )
    })
  )
  .build();
