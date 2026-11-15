import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { eventDeliveryAttemptPresenter } from '../presenters';
import { eventDeliveryAttemptService } from '../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let eventDeliveryAttemptController = app.controller({
  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        eventDeliveryAttemptId: v.string()
      })
    )
    .do(async ctx => {
      let eventDeliveryAttempt = await eventDeliveryAttemptService.getEventDeliveryAttemptById(
        { id: ctx.input.eventDeliveryAttemptId, tenant: ctx.tenant }
      );

      return eventDeliveryAttemptPresenter(eventDeliveryAttempt, { includePayload: true });
    }),

  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),

          eventIds: v.optional(v.array(v.string())),
          intentIds: v.optional(v.array(v.string())),
          destinationIds: v.optional(v.array(v.string())),
          status: v.optional(v.array(v.enumOf(['succeeded', 'failed'])))
        })
      )
    )
    .do(async ctx => {
      let paginator = await eventDeliveryAttemptService.listEventDeliveryAttempts({
        tenant: ctx.tenant,

        eventIds: ctx.input.eventIds,
        intentIds: ctx.input.intentIds,
        destinationIds: ctx.input.destinationIds,
        status: ctx.input.status
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, i =>
        eventDeliveryAttemptPresenter(i, { includePayload: false })
      );
    })
});
