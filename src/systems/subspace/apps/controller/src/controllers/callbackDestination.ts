import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { callbackDestinationService } from '@metorial-subspace/module-callback';
import { callbackDestinationPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantWithoutEnvironmentApp } from './tenant';

export let callbackDestinationApp = tenantWithoutEnvironmentApp.use(async ctx => {
  let callbackDestinationId = ctx.body.callbackDestinationId;
  if (!callbackDestinationId) throw new Error('Callback destination ID is required');

  let callbackDestination = await callbackDestinationService.getCallbackDestinationById({
    tenant: ctx.tenant,
    solution: ctx.solution,
    callbackDestinationId
  });

  return { callbackDestination };
});

export let callbackDestinationController = app.controller({
  list: tenantWithoutEnvironmentApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await callbackDestinationService.listCallbackDestinations({
        tenant: ctx.tenant,
        solution: ctx.solution
      });
      let list = await paginator.run(ctx.input);
      return Paginator.presentLight(list, callbackDestinationPresenter);
    }),

  get: callbackDestinationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackDestinationId: v.string()
      })
    )
    .do(async ctx => callbackDestinationPresenter(ctx.callbackDestination)),

  create: tenantWithoutEnvironmentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),
        url: v.string()
      })
    )
    .do(async ctx => {
      let callbackDestination = await callbackDestinationService.createCallbackDestination({
        tenant: ctx.tenant,
        solution: ctx.solution,
        input: {
          name: ctx.input.name!,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          url: ctx.input.url!
        }
      });
      return callbackDestinationPresenter(callbackDestination);
    }),

  update: callbackDestinationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackDestinationId: v.string(),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),
        url: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let callbackDestination = await callbackDestinationService.updateCallbackDestination({
        tenant: ctx.tenant,
        solution: ctx.solution,
        callbackDestination: ctx.callbackDestination,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          url: ctx.input.url
        }
      });
      return callbackDestinationPresenter(callbackDestination);
    }),

  archive: callbackDestinationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackDestinationId: v.string()
      })
    )
    .do(async ctx => {
      let callbackDestination = await callbackDestinationService.archiveCallbackDestination({
        tenant: ctx.tenant,
        solution: ctx.solution,
        callbackDestination: ctx.callbackDestination
      });
      return callbackDestinationPresenter(callbackDestination);
    })
});
