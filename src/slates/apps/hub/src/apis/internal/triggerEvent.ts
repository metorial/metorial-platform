import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { triggerEventPresenter } from '../../presenters';
import { triggerEventService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let triggerEventApp = tenantApp.use(async ctx => {
  let triggerEventId = ctx.body.triggerEventId;
  if (!triggerEventId) throw new Error('Trigger Event ID is required');

  let triggerEvent = await triggerEventService.getTriggerEventById({
    id: triggerEventId,
    tenant: ctx.tenant
  });

  return { triggerEvent };
});

export let triggerEventController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          callbackIds: v.optional(v.array(v.string())),
          callbackInstanceIds: v.optional(v.array(v.string())),
          triggerRegistrationIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await triggerEventService.listTriggerEvents({
        tenant: ctx.tenant,
        callbackIds: ctx.input.callbackIds,
        callbackInstanceIds: ctx.input.callbackInstanceIds,
        triggerRegistrationIds: ctx.input.triggerRegistrationIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, triggerEventPresenter);
    }),

  get: triggerEventApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        triggerEventId: v.string()
      })
    )
    .do(async ctx => triggerEventPresenter(ctx.triggerEvent)),

  getMany: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        triggerEventIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let events = await triggerEventService.getManyTriggerEventsByIds({
        tenant: ctx.tenant,
        ids: ctx.input.triggerEventIds
      });

      return events.map(triggerEventPresenter);
    })
});
