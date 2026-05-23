import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { slateTriggerEventPresenter } from '../../presenters';
import { slateTriggerEventService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let slateTriggerEventApp = tenantApp.use(async ctx => {
  let slateTriggerEventId = ctx.body.slateTriggerEventId;
  if (!slateTriggerEventId) throw new Error('Trigger event ID is required');

  let event = await slateTriggerEventService.getTriggerEventById({
    tenant: ctx.tenant,
    id: slateTriggerEventId
  });

  return { event };
});

export let slateTriggerEventController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          triggerReceiverIds: v.optional(v.array(v.string())),
          triggerReceiverTriggerIds: v.optional(v.array(v.string())),
          eventTypes: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await slateTriggerEventService.listTriggerEvents({
        tenant: ctx.tenant,
        receiverIds: ctx.input.triggerReceiverIds,
        receiverTriggerIds: ctx.input.triggerReceiverTriggerIds,
        eventTypes: ctx.input.eventTypes
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, slateTriggerEventPresenter);
    }),

  get: slateTriggerEventApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateTriggerEventId: v.string()
      })
    )
    .do(async ctx => slateTriggerEventPresenter(ctx.event))
});
