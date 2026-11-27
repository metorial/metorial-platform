import { v } from '@lowerdeck/validation';
import { usageIntervalValues } from '@metorial/module-usage/src/lib/interval';
import {
  USAGE_OTHER_GROUP,
  usageGroupByValues,
  usageMetricKinds,
  type UsageCounters
} from '@metorial/module-usage/src/lib/types';
import { Presenter } from '@metorial/presenter';
import { instanceUsageSummaryType, instanceUsageTimelineType } from '../../types';

let presentUsageMetrics = (
  d: UsageCounters & { activeConsumers: number; activeAgents: number }
) => ({
  count: d.count,
  success_count: Math.max(0, d.count - d.errorCount),
  error_count: d.errorCount,
  error_rate: d.count ? d.errorCount / d.count : 0,
  duration_ms_sum: d.durationMsSum,
  duration_ms_avg: d.durationCount ? d.durationMsSum / d.durationCount : null,
  duration_ms_max: d.durationCount ? d.durationMsMax : null,
  active_consumers: d.activeConsumers,
  active_agents: d.activeAgents
});

let presentUsageGroup = (group: string | null) => ({
  group: group == USAGE_OTHER_GROUP ? null : group,
  is_other: group == USAGE_OTHER_GROUP
});

let usageMetricFields = {
  count: v.number({ description: 'Number of recorded events.', examples: [128] }),
  success_count: v.number({
    description: 'Number of events that did not fail.',
    examples: [120]
  }),
  error_count: v.number({ description: 'Number of failed events.', examples: [8] }),
  error_rate: v.number({
    description: 'Share of failed events between 0 and 1.',
    examples: [0.0625]
  }),
  duration_ms_sum: v.number({
    description:
      'Total recorded duration in milliseconds. For connection time this is the total time connected.',
    examples: [48210]
  }),
  duration_ms_avg: v.nullable(
    v.number({
      description: 'Average duration in milliseconds, or null if no durations were recorded.',
      examples: [376.6]
    })
  ),
  duration_ms_max: v.nullable(
    v.number({
      description: 'Longest duration in milliseconds, or null if no durations were recorded.',
      examples: [2100]
    })
  ),
  active_consumers: v.number({
    description:
      'Number of distinct clients with tool calls, messages, or connections in the bucket.',
    examples: [12]
  }),
  active_agents: v.number({
    description:
      'Number of distinct agents, identified by agent instance or client participant, with tool calls, messages, or connections in the bucket.',
    examples: [4]
  })
};

let usageKindValidator = v.enumOf([...usageMetricKinds], {
  description: 'The usage metric the values describe.'
});

let usageRangeFields = {
  instance_id: v.string({ description: 'The instance the usage belongs to.' }),
  from: v.date({ description: 'Inclusive start of the effective range.' }),
  to: v.date({ description: 'Exclusive end of the effective range.' }),
  kinds: v.array(usageKindValidator, { description: 'Usage metrics included in the result.' }),
  group_by: v.nullable(
    v.enumOf(usageGroupByValues, {
      description: 'Dimension the series or top list is grouped by.'
    })
  )
};

let usageGroupFields = {
  group: v.nullable(
    v.string({
      description:
        'Value of the group_by dimension, such as a provider id or tool key. Null for the overflow group or when the dimension is unknown.'
    })
  ),
  is_other: v.boolean({
    description: 'Whether this entry aggregates every group outside the top groups.'
  })
};

let usagePointValidator = v.object({
  timestamp: v.date({ description: 'Inclusive UTC bucket start.' }),
  ...usageMetricFields
});

export let v1InstanceUsageTimelinePresenter = Presenter.create(instanceUsageTimelineType)
  .presenter(async ({ instanceId, timeline }) => ({
    object: 'instance.usage.timeline' as const,
    instance_id: instanceId,
    from: timeline.from,
    to: timeline.to,
    kinds: timeline.kinds,
    group_by: timeline.groupBy,
    interval: timeline.interval,
    total: timeline.total.map(point => ({
      timestamp: point.ts,
      ...presentUsageMetrics(point)
    })),
    series: timeline.series.map(series => ({
      kind: series.kind,
      ...presentUsageGroup(series.group),
      points: series.points.map(point => ({
        timestamp: point.ts,
        ...presentUsageMetrics(point)
      }))
    }))
  }))
  .schema(
    v.object({
      object: v.literal('instance.usage.timeline', {
        description: "String representing the object's type."
      }),
      ...usageRangeFields,
      interval: v.enumOf(usageIntervalValues, { description: 'Effective bucket interval.' }),
      total: v.array(usagePointValidator, {
        description: 'Chronological buckets summed across every series.'
      }),
      series: v.array(
        v.object({
          kind: v.nullable(usageKindValidator),
          ...usageGroupFields,
          points: v.array(usagePointValidator, { description: 'Chronological buckets.' })
        }),
        {
          description:
            'One series per kind (or per group when group_by is a dimension), ordered by volume with the overflow group last.'
        }
      )
    })
  )
  .build();

export let v1InstanceUsageSummaryPresenter = Presenter.create(instanceUsageSummaryType)
  .presenter(async ({ instanceId, summary }) => ({
    object: 'instance.usage.summary' as const,
    instance_id: instanceId,
    from: summary.from,
    to: summary.to,
    kinds: summary.kinds,
    group_by: summary.groupBy,
    total: presentUsageMetrics(summary.total),
    by_kind: summary.byKind.map(entry => ({
      kind: entry.kind,
      ...presentUsageMetrics(entry)
    })),
    top: summary.top.map(entry => ({
      ...presentUsageGroup(entry.group),
      ...presentUsageMetrics(entry)
    }))
  }))
  .schema(
    v.object({
      object: v.literal('instance.usage.summary', {
        description: "String representing the object's type."
      }),
      ...usageRangeFields,
      total: v.object(usageMetricFields, { description: 'Totals across every kind.' }),
      by_kind: v.array(v.object({ kind: usageKindValidator, ...usageMetricFields }), {
        description: 'Totals per requested kind.'
      }),
      top: v.array(v.object({ ...usageGroupFields, ...usageMetricFields }), {
        description: 'Largest groups for group_by, ordered by count. Empty without group_by.'
      })
    })
  )
  .build();
