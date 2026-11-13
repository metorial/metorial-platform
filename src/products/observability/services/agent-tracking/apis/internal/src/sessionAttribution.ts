import { v } from '@lowerdeck/validation';
import { sessionAttributionService } from '@mtsrc/agent-tracking-module-sessions';
import { sessionQueryService } from '@mtsrc/agent-tracking-module-sessions';
import {
  maxTopSessions,
  sessionMetrics,
  sessionStats,
  sessionTopFields
} from '@mtsrc/agent-tracking-module-sessions';
import { sessionAttributionPresenter } from './presenters/sessionAttribution';
import { organizationApp } from './_app';
import {
  queryFiltersSchema,
  queryGroupBySchema,
  queryRangeSchema,
  queryScopeSchema
} from './usage';

export let sessionAttributionRoutes = {
  query: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        scope: queryScopeSchema,
        range: queryRangeSchema,

        filters: queryFiltersSchema,
        groupBy: queryGroupBySchema,
        stats: v.array(v.enumOf(sessionStats), { modifiers: [v.minLength(1)] }),
        metrics: v.optional(
          v.array(v.enumOf(sessionMetrics), { modifiers: [v.minLength(1)] })
        ),
        top: v.optional(
          v.object({
            by: v.enumOf(sessionTopFields),
            limit: v.number({
              modifiers: [v.integer(), v.minValue(1), v.maxValue(maxTopSessions)]
            })
          })
        )
      })
    )
    .do(async ctx => {
      let result = await sessionQueryService.querySessions({
        organization: ctx.organization,
        scope: ctx.input.scope,
        query: {
          range: ctx.input.range,
          filters: ctx.input.filters ?? {},
          groupBy: ctx.input.groupBy ?? [],
          stats: [...new Set(ctx.input.stats)],
          metrics: ctx.input.metrics ? [...new Set(ctx.input.metrics)] : undefined,
          top: ctx.input.top
        }
      });

      return { object: 'agent_tracking#session_query', ...result };
    }),

  assign: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        sessionKey: v.string(),
        kind: v.string(),
        entityId: v.nullable(v.string())
      })
    )
    .do(async ctx => {
      let session = await sessionAttributionService.assignSession({
        organization: ctx.organization,
        sessionKey: ctx.input.sessionKey,
        kind: ctx.input.kind,
        entityId: ctx.input.entityId
      });

      return sessionAttributionPresenter(session);
    })
};
