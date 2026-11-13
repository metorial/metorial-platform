import { v } from '@lowerdeck/validation';
import { usageQueryService } from '../facts';
import { maxGroupBy, maxGroups, usageIntervals, usageMetrics } from '../facts/usageQuery';
import { organizationApp } from './_app';

let maxFilterValues = 1000;

export let queryScopeSchema = v.optional(
  v.object({
    projectIds: v.optional(v.array(v.string(), { modifiers: [v.maxLength(100)] })),
    instanceIds: v.optional(v.array(v.string(), { modifiers: [v.maxLength(100)] }))
  })
);

export let queryRangeSchema = v.object({ from: v.date(), to: v.date() });

export let queryFiltersSchema = v.optional(
  v.record(
    v.object({
      in: v.optional(v.array(v.string(), { modifiers: [v.maxLength(maxFilterValues)] })),
      notIn: v.optional(v.array(v.string(), { modifiers: [v.maxLength(maxFilterValues)] }))
    })
  )
);

export let queryGroupBySchema = v.optional(
  v.array(v.string(), { modifiers: [v.maxLength(maxGroupBy)] })
);

export let usageController = organizationApp.controller({
  query: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        scope: queryScopeSchema,
        range: queryRangeSchema,

        interval: v.optional(v.enumOf(usageIntervals)),
        timeZone: v.optional(v.string({ modifiers: [v.minLength(1), v.maxLength(64)] })),
        metrics: v.array(v.enumOf(usageMetrics), { modifiers: [v.minLength(1)] }),
        groupBy: queryGroupBySchema,
        filters: queryFiltersSchema,
        allocation: v.optional(v.enumOf(['full', 'split'])),

        orderBy: v.optional(
          v.object({
            by: v.string(),
            direction: v.optional(v.enumOf(['asc', 'desc']))
          })
        ),
        limit: v.optional(
          v.number({ modifiers: [v.integer(), v.minValue(1), v.maxValue(maxGroups)] })
        )
      })
    )
    .do(async ctx => {
      let result = await usageQueryService.queryUsage({
        organization: ctx.organization,
        scope: ctx.input.scope,
        query: {
          range: ctx.input.range,
          interval: ctx.input.interval,
          timeZone: ctx.input.timeZone,
          metrics: [...new Set(ctx.input.metrics)],
          groupBy: ctx.input.groupBy ?? [],
          filters: ctx.input.filters ?? {},
          allocation: ctx.input.allocation ?? 'full',
          orderBy: ctx.input.orderBy
            ? {
                by: ctx.input.orderBy.by,
                direction: ctx.input.orderBy.direction ?? 'desc'
              }
            : undefined,
          limit: ctx.input.limit
        }
      });

      return { object: 'groundstation#usage_query', ...result };
    })
});
