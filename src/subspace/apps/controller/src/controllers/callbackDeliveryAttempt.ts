import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { callbackDeliveryService } from '@metorial-subspace/module-callback';
import {
  callbackDeliveryAttemptListPresenter,
  callbackDeliveryAttemptPresenter
} from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantApp } from './tenant';

export let callbackDeliveryAttemptController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          callbackId: v.string(),
          destinationIds: v.optional(v.array(v.string())),
          status: v.optional(v.array(v.enumOf(['failed', 'succeeded'])))
        })
      )
    )
    .do(async ctx =>
      callbackDeliveryAttemptListPresenter(
        await callbackDeliveryService.listCallbackDeliveryAttempts({
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
        eventDeliveryAttemptId: v.string()
      })
    )
    .do(async ctx =>
      callbackDeliveryAttemptPresenter(
        await callbackDeliveryService.getCallbackDeliveryAttempt({
          tenant: ctx.tenant,
          solution: ctx.solution,
          environment: ctx.environment,
          callbackId: ctx.input.callbackId,
          eventDeliveryAttemptId: ctx.input.eventDeliveryAttemptId
        })
      )
    )
});
