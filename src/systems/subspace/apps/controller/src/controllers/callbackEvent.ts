import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { callbackEventService } from '@metorial-subspace/module-callback';
import {
  callbackEventListPresenter,
  callbackEventPresenter
} from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantApp } from './tenant';

export let callbackEventController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          callbackId: v.string(),
          eventTypes: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx =>
      callbackEventListPresenter(
        await callbackEventService.listCallbackEvents({
          tenant: ctx.tenant,
          solution: ctx.solution,
          environment: ctx.environment,
          callbackId: ctx.input.callbackId,
          input: {
            eventTypes: ctx.input.eventTypes,
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
        slateTriggerEventId: v.string()
      })
    )
    .do(async ctx =>
      callbackEventPresenter(
        await callbackEventService.getCallbackEvent({
          tenant: ctx.tenant,
          solution: ctx.solution,
          environment: ctx.environment,
          callbackId: ctx.input.callbackId,
          slateTriggerEventId: ctx.input.slateTriggerEventId
        })
      )
    )
});
