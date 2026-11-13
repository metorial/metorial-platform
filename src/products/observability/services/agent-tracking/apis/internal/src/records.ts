import { v } from '@lowerdeck/validation';
import { recordReadbackService } from '@mtsrc/agent-tracking-module-records';
import { app } from './_app';

let maxListLimit = 5000;

export let recordsController = app.controller({
  list: app
    .handler()
    .input(
      v.object({
        organizationId: v.optional(v.string()),
        instanceId: v.optional(v.string()),
        lane: v.optional(v.enumOf(['live', 'backfill'])),
        limit: v.optional(v.number({ modifiers: [v.positive(), v.integer()] }))
      })
    )
    .do(async ctx => {
      let items = await recordReadbackService.list({
        organizationId: ctx.input.organizationId,
        instanceId: ctx.input.instanceId,
        lane: ctx.input.lane,
        limit: Math.min(ctx.input.limit ?? maxListLimit, maxListLimit)
      });

      return { items: items.map(item => ({ lane: item.lane, record: item.record })) };
    }),

  clear: app
    .handler()
    .input(v.object({}))
    .do(async () => {
      await recordReadbackService.clear();

      return { cleared: true };
    }),

  setBusy: app
    .handler()
    .input(v.object({ busy: v.boolean() }))
    .do(async ctx => {
      await recordReadbackService.setBusy({ busy: ctx.input.busy });

      return { busy: ctx.input.busy };
    })
});
