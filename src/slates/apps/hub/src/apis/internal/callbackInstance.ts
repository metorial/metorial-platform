import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { callbackInstancePresenter } from '../../presenters';
import { callbackInstanceService } from '../../services';
import { app } from './_app';
import { callbackApp } from './callback';
import { tenantApp } from './tenant';

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
        authConfigId: v.optional(v.string()),
        triggerGroupSelections: v.optional(v.record(v.record(v.any())))
      })
    )
    .do(async ctx => {
      let instance = await callbackInstanceService.createCallbackInstance({
        tenant: ctx.tenant,
        callback: ctx.callback,
        input: {
          slateInstanceId: ctx.input.slateInstanceId,
          authConfigId: ctx.input.authConfigId,
          triggerGroupSelections: ctx.input.triggerGroupSelections
        }
      });

      return {
        ...callbackInstancePresenter(instance),
        selectableTriggerGroups: instance.selectableTriggerGroups,
        ignoredSelectionKeys: instance.ignoredSelectionKeys
      };
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
    .do(async ctx => ({
      ...callbackInstancePresenter(ctx.callbackInstance),
      selectableTriggerGroups: await callbackInstanceService.listSelectableTriggerGroups({
        callbackInstance: ctx.callbackInstance
      })
    })),

  listSelectionOptions: callbackInstanceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackId: v.string(),
        callbackInstanceId: v.string(),
        triggerGroupKey: v.string(),
        field: v.string(),
        query: v.optional(v.string()),
        pageToken: v.optional(v.any()),
        pageTokenSource: v.optional(v.enumOf(['own', 'linked'])),
        selection: v.optional(v.record(v.any())),
        linkedAuthConfigIds: v.optional(v.array(v.string()))
      })
    )
    .do(async ctx =>
      callbackInstanceService.listSelectionOptions({
        tenant: ctx.tenant,
        callbackInstance: ctx.callbackInstance,
        input: {
          triggerGroupKey: ctx.input.triggerGroupKey,
          field: ctx.input.field,
          query: ctx.input.query,
          pageToken: ctx.input.pageToken,
          pageTokenSource: ctx.input.pageTokenSource,
          selection: ctx.input.selection,
          linkedAuthConfigIds: ctx.input.linkedAuthConfigIds
        }
      })
    ),

  getMany: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackInstanceIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let instances = await callbackInstanceService.getManyCallbackInstancesByIds({
        tenant: ctx.tenant,
        ids: ctx.input.callbackInstanceIds
      });

      return instances.map(callbackInstancePresenter);
    }),

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
