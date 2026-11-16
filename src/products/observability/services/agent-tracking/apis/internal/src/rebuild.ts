import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { rebuildRunPresenter } from './presenters/rebuildRun';
import { rebuildLayers } from '@mtsrc/agent-tracking-layers';
import { rebuildRunService } from '@mtsrc/agent-tracking-module-rebuild';
import { organizationApp } from './_app';

let statuses = ['queued', 'running', 'completed', 'failed', 'cancelled'] as const;

export let rebuildController = organizationApp.controller({
  start: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),

        scope: v.optional(
          v.object({
            projectId: v.optional(v.string()),
            instanceId: v.optional(v.string())
          })
        ),
        range: v.object({ from: v.date(), to: v.date() }),
        layers: v.array(v.enumOf(rebuildLayers), { modifiers: [v.minLength(1)] }),
        reason: v.optional(v.string({ modifiers: [v.maxLength(500)] }))
      })
    )
    .do(async ctx => {
      let rebuildRun = await rebuildRunService.startRebuildRun({
        organization: ctx.organization,
        input: {
          scope: ctx.input.scope,
          range: ctx.input.range,
          layers: ctx.input.layers,
          reason: ctx.input.reason
        }
      });

      return rebuildRunPresenter(rebuildRun);
    }),

  get: organizationApp
    .handler()
    .input(v.object({ organizationId: v.string(), rebuildRunId: v.string() }))
    .do(async ctx => {
      let rebuildRun = await rebuildRunService.getRebuildRunById({
        organization: ctx.organization,
        rebuildRunId: ctx.input.rebuildRunId
      });

      return rebuildRunPresenter(rebuildRun);
    }),

  list: organizationApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          organizationId: v.string(),

          statuses: v.optional(v.array(v.enumOf(statuses)))
        })
      )
    )
    .do(async ctx => {
      let paginator = await rebuildRunService.listRebuildRuns({
        organization: ctx.organization,
        statuses: ctx.input.statuses
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, rebuildRunPresenter);
    }),

  cancel: organizationApp
    .handler()
    .input(v.object({ organizationId: v.string(), rebuildRunId: v.string() }))
    .do(async ctx => {
      let rebuildRun = await rebuildRunService.getRebuildRunById({
        organization: ctx.organization,
        rebuildRunId: ctx.input.rebuildRunId
      });

      rebuildRun = await rebuildRunService.cancelRebuildRun({ rebuildRun });

      return rebuildRunPresenter(rebuildRun);
    })
});
