import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { eventDeliveryIntentPresenter } from '../presenters';
import { eventDeliveryIntentService } from '../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let eventDeliveryIntentController = app.controller({
  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        eventDeliveryIntentId: v.string()
      })
    )
    .do(async ctx => {
      let eventDeliveryIntent = await eventDeliveryIntentService.getEventDeliveryIntentById({
        id: ctx.input.eventDeliveryIntentId,
        tenant: ctx.tenant
      });

      return eventDeliveryIntentPresenter(eventDeliveryIntent, { includePayload: true });
    }),

  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),

          eventIds: v.optional(v.array(v.string())),
          destinationIds: v.optional(v.array(v.string())),
          status: v.optional(v.array(v.enumOf(['delivered', 'failed', 'retrying', 'pending'])))
        })
      )
    )
    .do(async ctx => {
      let paginator = await eventDeliveryIntentService.listEventDeliveryIntents({
        tenant: ctx.tenant,

        eventIds: ctx.input.eventIds,
        destinationIds: ctx.input.destinationIds,
        status: ctx.input.status
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, i =>
        eventDeliveryIntentPresenter(i, { includePayload: false })
      );
    })
});
