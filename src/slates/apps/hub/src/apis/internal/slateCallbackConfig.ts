import { v } from '@lowerdeck/validation';
import { slateCallbackConfigPresenter } from '../../presenters';
import { slateCallbackConfigService, slateService, slateVersionService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

let callbackConfigInput = v.object({
  tenantId: v.string(),
  slateCallbackConfigId: v.string()
});

export let slateCallbackConfigController = app.controller({
  getSchema: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateId: v.string(),
        slateVersionId: v.string(),
        triggerIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let slate = await slateService.getSlateById({ id: ctx.input.slateId });
      let slateVersion = await slateVersionService.getSlateVersionById({
        slate,
        id: ctx.input.slateVersionId
      });
      return {
        schema: await slateCallbackConfigService.getCallbackConfigSchemaForVersion({
          slate,
          slateVersion,
          triggerIds: ctx.input.triggerIds
        })
      };
    }),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateId: v.string(),
        slateVersionId: v.string(),
        triggerIds: v.array(v.string()),
        values: v.record(v.string())
      })
    )
    .do(async ctx => {
      let slate = await slateService.getSlateById({ id: ctx.input.slateId });
      let slateVersion = await slateVersionService.getSlateVersionById({
        slate,
        id: ctx.input.slateVersionId
      });
      let callbackConfig = await slateCallbackConfigService.createSlateCallbackConfig({
        tenant: ctx.tenant,
        slate,
        slateVersion,
        triggerIds: ctx.input.triggerIds,
        values: ctx.input.values
      });
      return slateCallbackConfigPresenter(callbackConfig);
    }),

  createNext: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        previousSlateCallbackConfigId: v.string(),
        slateVersionId: v.string(),
        triggerIds: v.array(v.string()),
        valuesPatch: v.record(v.string())
      })
    )
    .do(async ctx => {
      let previous = await slateCallbackConfigService.getSlateCallbackConfigById({
        tenant: ctx.tenant,
        id: ctx.input.previousSlateCallbackConfigId
      });
      let slateVersion = await slateVersionService.getSlateVersionById({
        slate: previous.slate,
        id: ctx.input.slateVersionId
      });
      let callbackConfig = await slateCallbackConfigService.createNextSlateCallbackConfig({
        tenant: ctx.tenant,
        previousSlateCallbackConfig: previous,
        slate: previous.slate,
        slateVersion,
        triggerIds: ctx.input.triggerIds,
        valuesPatch: ctx.input.valuesPatch
      });
      return slateCallbackConfigPresenter(callbackConfig);
    }),

  get: tenantApp
    .handler()
    .input(callbackConfigInput)
    .do(async ctx => {
      let callbackConfig = await slateCallbackConfigService.getSlateCallbackConfigById({
        tenant: ctx.tenant,
        id: ctx.input.slateCallbackConfigId
      });
      return slateCallbackConfigPresenter(callbackConfig);
    }),

  delete: tenantApp
    .handler()
    .input(callbackConfigInput)
    .do(async ctx => {
      let callbackConfig = await slateCallbackConfigService.getSlateCallbackConfigById({
        tenant: ctx.tenant,
        id: ctx.input.slateCallbackConfigId
      });
      await slateCallbackConfigService.deleteSlateCallbackConfig({
        tenant: ctx.tenant,
        slateCallbackConfig: callbackConfig
      });
      return { success: true };
    })
});
