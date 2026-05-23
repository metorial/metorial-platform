import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { providerAuthConfigService } from '@metorial-subspace/module-auth';
import {
  callbackInstanceService,
  enrichCallbackInstanceTriggers,
  enrichSingleCallbackInstanceTriggers
} from '@metorial-subspace/module-callback';
import { providerConfigService } from '@metorial-subspace/module-deployment';
import { callbackInstancePresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { callbackApp } from './callback';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';

export let callbackInstanceApp = callbackApp.use(async ctx => {
  let callbackInstanceId = ctx.body.callbackInstanceId;
  if (!callbackInstanceId) throw new Error('CallbackInstance ID is required');

  let callbackInstance = await callbackInstanceService.get({
    tenant: ctx.tenant,
    solution: ctx.solution,
    environment: ctx.environment,
    callbackId: ctx.callback.id,
    callbackInstanceId
  });

  return { callbackInstance };
});

export let callbackInstanceController = app.controller({
  list: callbackApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          callbackId: v.string(),
          ids: v.optional(v.array(v.string())),
          status: v.optional(v.array(v.enumOf(['attached', 'detached']))),
          allowDeleted: v.optional(v.boolean()),
          providerConfigIds: v.optional(v.array(v.string())),
          providerAuthConfigIds: v.optional(v.array(v.string())),
          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await callbackInstanceService.list({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        callbackIds: [ctx.callback.id],
        ids: ctx.input.ids,
        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,
        providerConfigIds: ctx.input.providerConfigIds,
        providerAuthConfigIds: ctx.input.providerAuthConfigIds,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });
      let list = await paginator.run(ctx.input);

      let triggersMap = await enrichCallbackInstanceTriggers(
        ctx.tenant,
        ctx.callback,
        list.items
      );

      return Paginator.presentLight(list, instance =>
        callbackInstancePresenter(instance, triggersMap.get(instance.id))
      );
    }),

  get: callbackInstanceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        callbackId: v.string(),
        callbackInstanceId: v.string()
      })
    )
    .do(async ctx => {
      let triggers = await enrichSingleCallbackInstanceTriggers(
        ctx.tenant,
        ctx.callback,
        ctx.callbackInstance
      );

      return callbackInstancePresenter(ctx.callbackInstance, triggers);
    }),

  attach: callbackApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        callbackId: v.string(),
        configId: v.string(),
        authConfigId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let config = await providerConfigService.getProviderConfigById({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        providerConfigId: ctx.input.configId
      });

      let authConfig = ctx.input.authConfigId
        ? await providerAuthConfigService.getProviderAuthConfigById({
            tenant: ctx.tenant,
            solution: ctx.solution,
            environment: ctx.environment,
            providerAuthConfigId: ctx.input.authConfigId
          })
        : undefined;

      let instance = await callbackInstanceService.attach({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        callback: ctx.callback,
        config,
        authConfig
      });

      let triggers = await enrichSingleCallbackInstanceTriggers(
        ctx.tenant,
        ctx.callback,
        instance
      );
      return callbackInstancePresenter(instance, triggers);
    }),

  detach: callbackInstanceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        callbackId: v.string(),
        callbackInstanceId: v.string()
      })
    )
    .do(async ctx => {
      let instance = await callbackInstanceService.detach({
        tenant: ctx.tenant,
        callbackInstance: ctx.callbackInstance
      });

      let triggers = await enrichSingleCallbackInstanceTriggers(
        ctx.tenant,
        ctx.callback,
        instance
      );
      return callbackInstancePresenter(instance, triggers);
    })
});
