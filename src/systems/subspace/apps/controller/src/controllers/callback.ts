import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { callbackService } from '@metorial-subspace/module-callback';
import { providerDeploymentService } from '@metorial-subspace/module-deployment';
import { callbackPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantApp } from './tenant';

export let callbackApp = tenantApp.use(async ctx => {
  let callbackId = ctx.body.callbackId;
  if (!callbackId) throw new Error('Callback ID is required');

  let callback = await callbackService.getCallbackById({
    tenant: ctx.tenant,
    solution: ctx.solution,
    environment: ctx.environment,
    callbackId
  });

  return { callback };
});

export let callbackController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          ids: v.optional(v.array(v.string())),
          status: v.optional(v.array(v.enumOf(['active', 'archived', 'deleted']))),
          allowDeleted: v.optional(v.boolean()),
          providerDeploymentIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await callbackService.listCallbacks({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        ids: ctx.input.ids,
        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,
        providerDeploymentIds: ctx.input.providerDeploymentIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, callbackPresenter);
    }),

  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        callbackId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let res = await callbackService.getCallbackById({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        callbackId: ctx.input.callbackId,
        allowDeleted: ctx.input.allowDeleted
      });

      return callbackPresenter(res);
    }),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerDeploymentId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),
        pollIntervalSecondsOverride: v.optional(v.nullable(v.number())),
        triggers: v.array(
          v.object({
            triggerId: v.string(),
            eventTypes: v.optional(v.array(v.string()))
          })
        ),
        destinationIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let providerDeployment = await providerDeploymentService.getProviderDeploymentById({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        providerDeploymentId: ctx.input.providerDeploymentId
      });

      let callback = await callbackService.createCallback({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        providerDeployment,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          pollIntervalSecondsOverride: ctx.input.pollIntervalSecondsOverride,
          triggers: ctx.input.triggers?.map(trigger => ({
            triggerId: trigger.triggerId!,
            eventTypes: trigger.eventTypes
          })),
          destinationIds: ctx.input.destinationIds ?? []
        }
      });

      return callbackPresenter(callback);
    }),

  update: callbackApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        callbackId: v.string(),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),
        triggers: v.optional(
          v.array(
            v.object({
              triggerId: v.string(),
              eventTypes: v.optional(v.array(v.string()))
            })
          )
        ),
        destinationIds: v.optional(v.array(v.string())),
        pollIntervalSecondsOverride: v.optional(v.nullable(v.number()))
      })
    )
    .do(async ctx => {
      let callback = await callbackService.updateCallback({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        callback: ctx.callback,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          triggers: ctx.input.triggers?.map(trigger => ({
            triggerId: trigger.triggerId!,
            eventTypes: trigger.eventTypes
          })),
          destinationIds: ctx.input.destinationIds,
          pollIntervalSecondsOverride: ctx.input.pollIntervalSecondsOverride
        }
      });
      return callbackPresenter(callback);
    }),

  archive: callbackApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        callbackId: v.string()
      })
    )
    .do(async ctx => {
      let callback = await callbackService.archiveCallback({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        callback: ctx.callback
      });
      return callbackPresenter(callback);
    })
});
