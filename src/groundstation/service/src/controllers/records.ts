import { preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { getRuntime } from '../runtime';
import { app } from './_app';

let maxListLimit = 5000;

let memorySink = () => {
  let sink = getRuntime().memorySink;

  if (!sink) {
    throw new ServiceError(
      preconditionFailedError({
        message: 'Record readback requires GROUNDSTATION_SINK=memory.'
      })
    );
  }

  return sink;
};

export let recordsController = app.controller({
  list: app
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        lane: v.optional(v.enumOf(['live', 'backfill'])),
        limit: v.optional(v.number({ modifiers: [v.positive(), v.integer()] }))
      })
    )
    .do(async ctx => {
      let items = memorySink().list({
        tenantId: ctx.input.tenantId,
        lane: ctx.input.lane,
        limit: Math.min(ctx.input.limit ?? maxListLimit, maxListLimit)
      });

      return { items: items.map(item => ({ lane: item.lane, record: item.record })) };
    }),

  clear: app
    .handler()
    .input(v.object({}))
    .do(async () => {
      memorySink().clear();

      return { cleared: true };
    }),

  setBusy: app
    .handler()
    .input(v.object({ busy: v.boolean() }))
    .do(async ctx => {
      memorySink().setBusy(ctx.input.busy);

      return { busy: ctx.input.busy };
    })
});
