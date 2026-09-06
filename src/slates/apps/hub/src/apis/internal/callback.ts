import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { callbackPresenter } from '../../presenters';
import { callbackService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let callbackApp = tenantApp.use(async ctx => {
  let callbackId = ctx.body.callbackId;
  if (!callbackId) throw new Error('Callback ID is required');

  let callback = await callbackService.getCallbackById({
    id: callbackId,
    tenant: ctx.tenant
  });

  return { callback };
});

export let callbackController = app.controller({
  list: tenantApp
    .handler()
    .input(Paginator.validate(v.object({ tenantId: v.string() })))
    .do(async ctx => {
      let paginator = await callbackService.listCallbacks({ tenant: ctx.tenant });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, callbackPresenter);
    }),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateId: v.string(),
        name: v.optional(v.string()),
        description: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let callback = await callbackService.createCallback({
        tenant: ctx.tenant,
        input: {
          slateId: ctx.input.slateId,
          name: ctx.input.name,
          description: ctx.input.description
        }
      });

      return callbackPresenter(callback);
    }),

  get: callbackApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackId: v.string()
      })
    )
    .do(async ctx => callbackPresenter(ctx.callback)),

  update: callbackApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackId: v.string(),
        name: v.optional(v.string()),
        description: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let callback = await callbackService.updateCallback({
        tenant: ctx.tenant,
        callback: ctx.callback,
        input: {
          name: ctx.input.name,
          description: ctx.input.description
        }
      });

      return callbackPresenter(callback);
    }),

  delete: callbackApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackId: v.string()
      })
    )
    .do(async ctx => {
      await callbackService.deleteCallback({
        tenant: ctx.tenant,
        callback: ctx.callback
      });

      return { success: true };
    })
});
