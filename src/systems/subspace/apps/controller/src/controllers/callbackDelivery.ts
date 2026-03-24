import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { callbackDeliveryService } from '@metorial-subspace/module-callback';
import {
  callbackDeliveryListPresenter,
  callbackDeliveryPresenter
} from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantApp } from './tenant';

export let callbackDeliveryController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          callbackId: v.string(),
          destinationIds: v.optional(v.array(v.string())),
          status: v.optional(v.array(v.enumOf(['pending', 'failed', 'delivered', 'retrying'])))
        })
      )
    )
    .do(async ctx =>
      callbackDeliveryListPresenter(
        await callbackDeliveryService.listCallbackDeliveries({
          tenant: ctx.tenant,
          solution: ctx.solution,
          environment: ctx.environment,
          callbackId: ctx.input.callbackId,
          input: {
            destinationIds: ctx.input.destinationIds,
            status: ctx.input.status,
            limit: ctx.input.limit,
            after: ctx.input.after,
            before: ctx.input.before,
            cursor: ctx.input.cursor,
            order: ctx.input.order
          }
        })
      )
    ),

  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        callbackId: v.string(),
        eventDeliveryIntentId: v.string()
      })
    )
    .do(async ctx =>
      callbackDeliveryPresenter(
        await callbackDeliveryService.getCallbackDelivery({
          tenant: ctx.tenant,
          solution: ctx.solution,
          environment: ctx.environment,
          callbackId: ctx.input.callbackId,
          eventDeliveryIntentId: ctx.input.eventDeliveryIntentId
        })
      )
    )
});
