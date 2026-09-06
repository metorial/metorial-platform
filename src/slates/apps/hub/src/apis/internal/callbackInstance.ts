import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { callbackInstancePresenter } from '../../presenters';
import { callbackInstanceService } from '../../services';
import { app } from './_app';
import { callbackApp } from './callback';

export let callbackInstanceApp = callbackApp.use(async ctx => {
  let callbackInstanceId = ctx.body.callbackInstanceId;
  if (!callbackInstanceId) throw new Error('Callback Instance ID is required');

  let callbackInstance = await callbackInstanceService.getCallbackInstanceById({
    id: callbackInstanceId,
    tenant: ctx.tenant,
    callback: ctx.callback
  });

  return { callbackInstance };
});

export let callbackInstanceController = app.controller({
  list: callbackApp
    .handler()
    .input(Paginator.validate(v.object({ tenantId: v.string(), callbackId: v.string() })))
    .do(async ctx => {
      let paginator = await callbackInstanceService.listCallbackInstances({
        tenant: ctx.tenant,
        callback: ctx.callback
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, callbackInstancePresenter);
    }),

  create: callbackApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackId: v.string(),
        slateInstanceId: v.string(),
        authConfigId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let instance = await callbackInstanceService.createCallbackInstance({
        tenant: ctx.tenant,
        callback: ctx.callback,
        input: {
          slateInstanceId: ctx.input.slateInstanceId,
          authConfigId: ctx.input.authConfigId
        }
      });

      return callbackInstancePresenter(instance);
    }),

  get: callbackInstanceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackId: v.string(),
        callbackInstanceId: v.string()
      })
    )
    .do(async ctx => callbackInstancePresenter(ctx.callbackInstance)),

  delete: callbackInstanceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackId: v.string(),
        callbackInstanceId: v.string()
      })
    )
    .do(async ctx => {
      await callbackInstanceService.deleteCallbackInstance({
        tenant: ctx.tenant,
        callbackInstance: ctx.callbackInstance
      });

      return { success: true };
    })
});
