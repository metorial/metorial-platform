import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { eventPresenter } from '../presenters';
import { callbackService, eventService, senderService } from '../services';
import { app } from './_app';
import { hubInternalTenantApp, tenantApp } from './tenant';

export let eventController = app.controller({
  createIdempotent: hubInternalTenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        senderId: v.string(),
        idempotencyKey: v.string(),
        topics: v.array(v.string()),
        eventType: v.string(),
        payloadJson: v.string(),
        headers: v.record(v.string()),
        onlyForDestinations: v.optional(v.array(v.string())),
        scopeId: v.optional(v.string()),
        callbackId: v.optional(v.string()),
        callbackInstanceId: v.optional(v.string()),
        callbackSourceId: v.optional(v.string()),
        callbackTriggerId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let sender = await senderService.getSenderById({ id: ctx.input.senderId });
      let callback = ctx.input.callbackId
        ? await callbackService.getCallbackById({
            id: ctx.input.callbackId,
            tenant: ctx.tenant
          })
        : undefined;
      let event = await eventService.createIdempotentEvent({
        tenant: ctx.tenant,
        sender,
        callback,
        input: {
          idempotencyKey: ctx.input.idempotencyKey,
          topics: ctx.input.topics,
          eventType: ctx.input.eventType,
          payloadJson: ctx.input.payloadJson,
          headers: ctx.input.headers,
          onlyForDestinations: ctx.input.onlyForDestinations,
          scopeId: ctx.input.scopeId,
          callbackInstanceId: ctx.input.callbackInstanceId,
          callbackSourceId: ctx.input.callbackSourceId,
          callbackTriggerId: ctx.input.callbackTriggerId
        }
      });
      return {
        id: event.id,
        idempotencyKey: event.idempotencyKey!,
        requestFingerprint: event.requestFingerprint!
      };
    }),

  getByIdempotencyKey: hubInternalTenantApp
    .handler()
    .input(v.object({ tenantId: v.string(), idempotencyKey: v.string() }))
    .do(async ctx => {
      let event = await eventService.getEventByIdempotencyKey({
        idempotencyKey: ctx.input.idempotencyKey,
        tenant: ctx.tenant
      });
      return {
        id: event.id,
        idempotencyKey: event.idempotencyKey!,
        requestFingerprint: event.requestFingerprint!
      };
    }),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        senderId: v.string(),
        scopeId: v.string(),

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
          onlyForDestinations: ctx.input.onlyForDestinations,
          scopeId: ctx.input.scopeId
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
          senderIds: v.optional(v.array(v.string())),
          scopeIds: v.optional(v.array(v.string())),
          callbackIds: v.optional(v.array(v.string())),
          statuses: v.optional(v.array(v.enumOf(['pending', 'delivered', 'failed']))),
          destinationIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await eventService.listEvents({
        tenant: ctx.tenant,

        eventTypes: ctx.input.eventTypes,
        topics: ctx.input.topics,
        senderIds: ctx.input.senderIds,
        scopeIds: ctx.input.scopeIds,
        callbackIds: ctx.input.callbackIds,
        statuses: ctx.input.statuses,
        destinationIds: ctx.input.destinationIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, i => eventPresenter(i, { includePayload: false }));
    })
});
