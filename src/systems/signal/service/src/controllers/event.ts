import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { eventPresenter } from '../presenters';
import { eventService, senderService } from '../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let eventController = app.controller({
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        senderId: v.string(),

        topics: v.array(v.string()),
        eventType: v.string(),
        payloadJson: v.string(),
        headers: v.record(v.string()),
        onlyForDestinations: v.optional(v.array(v.string()))
      })
    )
    .do(async ctx => {
      let sender = await senderService.getSenderById({ id: ctx.input.senderId });

      let event = await eventService.createEvent({
        tenant: ctx.tenant,
        sender,
        input: {
          topics: ctx.input.topics,
          headers: ctx.input.headers,
          eventType: ctx.input.eventType,
          payloadJson: ctx.input.payloadJson,
          onlyForDestinations: ctx.input.onlyForDestinations
        }
      });

      return eventPresenter(event, { includePayload: true });
    }),

  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        eventId: v.string()
      })
    )
    .do(async ctx => {
      let event = await eventService.getEventById({
        id: ctx.input.eventId,
        tenant: ctx.tenant
      });

      return eventPresenter(event, { includePayload: true });
    }),

  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),

          eventTypes: v.optional(v.array(v.string())),
          topics: v.optional(v.array(v.string())),
          senderIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await eventService.listEvents({
        tenant: ctx.tenant,

        eventTypes: ctx.input.eventTypes,
        topics: ctx.input.topics,
        senderIds: ctx.input.senderIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, i => eventPresenter(i, { includePayload: false }));
    })
});
