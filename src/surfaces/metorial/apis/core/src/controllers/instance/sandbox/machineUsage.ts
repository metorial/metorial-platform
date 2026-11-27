import { v } from '@lowerdeck/validation';
import { sandboxMachineUsageService } from '@metorial/module-sandbox';
import {
  sandboxMachineUsageSummaryPresenter,
  sandboxMachineUsageTimelinePresenter
} from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { requirePathParam, sandboxInstanceGroup, sandboxReadScopes } from './_middleware';

let usageQueryFields = {
  from: v.date({
    description:
      'Inclusive start of the requested range. History is retained for 30 days; older starts are clamped. Maximum requested span is 31 days.'
  }),
  to: v.date({
    description:
      'Exclusive end of the requested range. Must follow from and cannot be in the future. Bounds are rounded outward to complete UTC buckets.'
  }),
  machine_instance_id: v.optional(v.union([v.string(), v.array(v.string())]), {
    description: 'Restrict usage to one or more executions of this machine.'
  }),
  group_by: v.optional(v.literal('machine_instance'), {
    description: 'Group by machine execution. Omit to aggregate the whole machine.'
  }),
  max_series: v.optional(
    v.number({
      preprocessors: [value => (typeof value === 'string' ? Number(value) : value)],
      modifiers: [v.integer(), v.minValue(1), v.maxValue(200)]
    }),
    {
      description:
        'Maximum individually reported groups, default 50. Remaining executions form an additional other group. Applies when grouping.'
    }
  )
};

export let sandboxMachineUsageController = Controller.create(
  {
    name: 'Sandbox machine usage history',
    description:
      'Aggregated measured CPU, memory, network, disk I/O, and observed runtime. History is flushed approximately every minute and is not billing consumption.'
  },
  {
    timeline: sandboxInstanceGroup
      .get(
        instancePath(
          'sandbox/machines/:machineId/usage/timeline',
          'sandbox.machines.usage.timeline'
        ),
        {
          name: 'Get sandbox machine usage timeline',
          description:
            'Returns chronological usage buckets. Minute data is retained for 7 days and hourly data for 30 days. Zero samples means no observations, not necessarily a stopped machine.'
        }
      )
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .query(
        'default',
        v.object({
          ...usageQueryFields,
          interval: v.optional(v.enumOf(['1m', '5m', '15m', '30m', '1h', '6h', '12h', '1d']), {
            description:
              'Bucket interval. Omit for automatic selection targeting about 500 points. At most 1500 points per series; intervals below one hour require a range within the last 7 days.'
          })
        })
      )
      .output(sandboxMachineUsageTimelinePresenter)
      .do(async ctx => {
        let usage = await sandboxMachineUsageService.timeline({
          instance: ctx.instance,
          machineId: requirePathParam(ctx.params, 'machineId'),
          from: ctx.query.from,
          to: ctx.query.to,
          instanceIds: normalizeArrayParam(ctx.query.machine_instance_id),
          groupBy: ctx.query.group_by,
          maxSeries: ctx.query.max_series,
          interval: ctx.query.interval
        });

        return sandboxMachineUsageTimelinePresenter.present({ usage });
      }),

    summary: sandboxInstanceGroup
      .get(
        instancePath(
          'sandbox/machines/:machineId/usage/summary',
          'sandbox.machines.usage.summary'
        ),
        {
          name: 'Get sandbox machine usage summary',
          description:
            'Returns totals and averages for a range. Summary bounds align independently to minute or hour source buckets. Use a timeline’s effective bounds to compare its totals with a summary.'
        }
      )
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .query('default', v.object(usageQueryFields))
      .output(sandboxMachineUsageSummaryPresenter)
      .do(async ctx => {
        let usage = await sandboxMachineUsageService.summary({
          instance: ctx.instance,
          machineId: requirePathParam(ctx.params, 'machineId'),
          from: ctx.query.from,
          to: ctx.query.to,
          instanceIds: normalizeArrayParam(ctx.query.machine_instance_id),
          groupBy: ctx.query.group_by,
          maxSeries: ctx.query.max_series
        });

        return sandboxMachineUsageSummaryPresenter.present({ usage });
      })
  }
);
