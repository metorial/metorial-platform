import { v } from '@lowerdeck/validation';
import { limitsService } from '@mtsrc/ai-gateway-module-limits';
import { projectService } from '@mtsrc/ai-gateway-module-scope';
import { platformLimitsSchema, projectRestrictionSchema } from '@mtsrc/ai-gateway-spec';
import {
  platformLimitEventsPresenter,
  platformLimitTargetPresenter
} from '../presenters/platformLimit';
import { app } from './_app';

let timestamp = v.number({ modifiers: [v.integer(), v.minValue(0)] });

// Platform limits are owned by Metorial's plans: the enterprise rate-limit system lists gateway
// projects as targets, pushes their resolved limits and drains trip and usage events back.
export let platformLimitController = app.controller({
  listTargets: app
    .handler()
    .input(
      v.object({
        organizationRef: v.string({ modifiers: [v.minLength(1)] }),
        projectRef: v.optional(v.string({ modifiers: [v.minLength(1)] }))
      })
    )
    .do(async ctx => {
      let projects = await projectService.listProjectsForOrganizationRef({
        organizationRef: ctx.input.organizationRef,
        projectRef: ctx.input.projectRef
      });

      return projects.map(platformLimitTargetPresenter);
    }),

  getTargets: app
    .handler()
    .input(v.object({ projectIds: v.array(v.string(), { modifiers: [v.maxLength(500)] }) }))
    .do(async ctx => {
      let projects = await projectService.listProjectsWithOrganization({
        projectIds: ctx.input.projectIds
      });

      return projects.map(platformLimitTargetPresenter);
    }),

  sync: app
    .handler()
    .input(
      v.object({
        projectId: v.string(),
        limits: platformLimitsSchema,
        disabled: v.optional(projectRestrictionSchema)
      })
    )
    .do(async ctx => {
      let project = await projectService.getProjectWithOrganization({
        projectId: ctx.input.projectId
      });

      let synced = await projectService.syncPlatformLimits({
        project,
        limits: ctx.input.limits,
        disabled: ctx.input.disabled
      });

      return platformLimitTargetPresenter(synced);
    }),

  drainEvents: app
    .handler()
    .input(v.object({ tripsBefore: timestamp, usageBefore: timestamp }))
    .do(async ctx =>
      platformLimitEventsPresenter(
        await limitsService.drainPlatformEvents({
          tripsBefore: ctx.input.tripsBefore,
          usageBefore: ctx.input.usageBefore
        })
      )
    ),

  ackEvents: app
    .handler()
    .input(
      v.object({
        tripBuckets: v.array(timestamp, { modifiers: [v.maxLength(5000)] }),
        usageHours: v.array(timestamp, { modifiers: [v.maxLength(5000)] })
      })
    )
    .do(async ctx => {
      await limitsService.ackPlatformEvents({
        tripBuckets: ctx.input.tripBuckets,
        usageHours: ctx.input.usageHours
      });

      return { object: 'ai_gateway#platform_limit_events.acknowledged' };
    })
});
