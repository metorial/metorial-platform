import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  callbackEventPresenter,
  callbackPresenter,
  eventDeliveryAttemptPresenter,
  eventDeliveryIntentPresenter
} from '../presenters';
import { callbackService, eventDeliveryAttemptService } from '../services';
import { app } from './_app';
import { subspaceInternalTenantApp, tenantApp } from './tenant';

let callbackApp = tenantApp.use(async ctx => {
  let callbackId = ctx.body.callbackId;
  if (!callbackId) throw new Error('Callback ID is required');

  let callback = await callbackService.getCallbackById({
    tenant: ctx.tenant,
    id: callbackId
  });

  return { callback };
});

let subspaceInternalCallbackApp = subspaceInternalTenantApp.use(async ctx => {
  let callbackId = ctx.body.callbackId;
  if (!callbackId) throw new Error('Callback ID is required');

  let callback = await callbackService.getCallbackById({
    tenant: ctx.tenant,
    id: callbackId
  });

  return { callback };
});

let callbackDestinationInput = v.object({
  externalId: v.string(),
  name: v.string(),
  description: v.optional(v.nullable(v.string())),
  eventTypes: v.optional(v.nullable(v.array(v.string()))),
  retry: v.optional(
    v.object({
      type: v.enumOf(['exponential', 'linear']),
      delaySeconds: v.number(),
      maxAttempts: v.number()
    })
  ),
  variant: v.object({
    type: v.enumOf(['http_endpoint']),
    url: v.string(),
    method: v.enumOf(['POST', 'PUT', 'PATCH'])
  })
});

export let callbackController = app.controller({
  upsert: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackId: v.string(),
        name: v.string(),
        description: v.optional(v.nullable(v.string())),
        eventTypes: v.optional(v.nullable(v.array(v.string()))),
        destinations: v.array(callbackDestinationInput)
      })
    )
    .do(async ctx => {
      let callback = await callbackService.upsertCallback({
        tenant: ctx.tenant,
        input: {
          callbackId: ctx.input.callbackId,
          name: ctx.input.name,
          description: ctx.input.description,
          eventTypes: ctx.input.eventTypes,
          destinations: ctx.input.destinations
        }
      });

      return callbackPresenter(callback);
    }),

  get: callbackApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackId: v.string()
      })
    )
    .do(async ctx => callbackPresenter(ctx.callback)),

  archive: callbackApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackId: v.string()
      })
    )
    .do(async ctx => {
      let callback = await callbackService.archiveCallback({
        callback: ctx.callback
      });
      return callbackPresenter(callback);
    }),

  recordEvent: callbackApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackId: v.string(),
        eventId: v.optional(v.nullable(v.string())),
        callbackInstanceId: v.optional(v.nullable(v.string())),
        sourceId: v.optional(v.nullable(v.string())),
        triggerId: v.optional(v.nullable(v.string())),
        triggerKey: v.optional(v.nullable(v.string())),
        status: v.optional(
          v.enumOf(['pending', 'processing', 'retrying', 'succeeded', 'failed', 'skipped'])
        ),
        eventType: v.string(),
        deliveryPayloadJson: v.optional(v.nullable(v.string())),
        inputJson: v.optional(v.nullable(v.string())),
        outputJson: v.optional(v.nullable(v.string())),
        errorCode: v.optional(v.nullable(v.string())),
        errorMessage: v.optional(v.nullable(v.string()))
      })
    )
    .do(async ctx => {
      let event = await callbackService.recordCallbackEvent({
        tenant: ctx.tenant,
        callback: ctx.callback,
        input: {
          eventId: ctx.input.eventId,
          callbackInstanceId: ctx.input.callbackInstanceId,
          sourceId: ctx.input.sourceId,
          triggerId: ctx.input.triggerId,
          triggerKey: ctx.input.triggerKey,
          status: ctx.input.status,
          eventType: ctx.input.eventType,
          deliveryPayloadJson: ctx.input.deliveryPayloadJson,
          inputJson: ctx.input.inputJson,
          outputJson: ctx.input.outputJson,
          errorCode: ctx.input.errorCode,
          errorMessage: ctx.input.errorMessage
        }
      });

      return callbackEventPresenter(event, { includePayload: true });
    }),

  recordDashboardTestEvent: subspaceInternalCallbackApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackId: v.string(),
        eventId: v.string(),
        callbackInstanceId: v.string(),
        eventType: v.string(),
        payloadJson: v.string()
      })
    )
    .do(async ctx => {
      let event = await callbackService.recordDashboardTestEvent({
        tenant: ctx.tenant,
        callback: ctx.callback,
        input: {
          eventId: ctx.input.eventId,
          callbackInstanceId: ctx.input.callbackInstanceId,
          eventType: ctx.input.eventType,
          payloadJson: ctx.input.payloadJson
        }
      });

      return callbackEventPresenter(event, { includePayload: true });
    }),

  listEvents: callbackApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          callbackId: v.string(),
          eventTypes: v.optional(v.array(v.string())),
          callbackInstanceIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await callbackService.listCallbackEvents({
        tenant: ctx.tenant,
        callback: ctx.callback,
        eventTypes: ctx.input.eventTypes,
        callbackInstanceIds: ctx.input.callbackInstanceIds
      });

      let list = await paginator.run(ctx.input);
      return Paginator.presentLight(list, event =>
        callbackEventPresenter(event, { includePayload: false })
      );
    }),

  listEventsByIds: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackEventIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let events = await callbackService.listCallbackEventsByIds({
        tenant: ctx.tenant,
        callbackEventIds: ctx.input.callbackEventIds
      });

      return await Promise.all(
        events.map(event => callbackEventPresenter(event, { includePayload: false }))
      );
    }),

  getEvent: callbackApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackId: v.string(),
        callbackEventId: v.string()
      })
    )
    .do(async ctx => {
      let event = await callbackService.getCallbackEvent({
        tenant: ctx.tenant,
        callback: ctx.callback,
        callbackEventId: ctx.input.callbackEventId
      });

      return callbackEventPresenter(event, { includePayload: true });
    }),

  listDeliveries: callbackApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          callbackId: v.string(),
          destinationIds: v.optional(v.array(v.string())),
          status: v.optional(v.array(v.enumOf(['delivered', 'failed', 'retrying', 'pending'])))
        })
      )
    )
    .do(async ctx => {
      let paginator = await callbackService.listCallbackDeliveryIntents({
        tenant: ctx.tenant,
        callback: ctx.callback,
        destinationIds: ctx.input.destinationIds,
        status: ctx.input.status
      });

      let list = await paginator.run(ctx.input);
      return Paginator.presentLight(list, intent =>
        eventDeliveryIntentPresenter(intent, { includePayload: false })
      );
    }),

  getDelivery: callbackApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackId: v.string(),
        eventDeliveryIntentId: v.string()
      })
    )
    .do(async ctx => {
      let intent = await callbackService.getCallbackDeliveryIntent({
        tenant: ctx.tenant,
        callback: ctx.callback,
        eventDeliveryIntentId: ctx.input.eventDeliveryIntentId
      });
      let attempts = await eventDeliveryAttemptService.listEventDeliveryAttemptsByIntentIds({
        tenant: ctx.tenant,
        intentIds: [ctx.input.eventDeliveryIntentId]
      });

      return eventDeliveryIntentPresenter(intent, {
        includePayload: true,
        attempts
      });
    }),

  listDeliveryAttempts: callbackApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          callbackId: v.string(),
          destinationIds: v.optional(v.array(v.string())),
          status: v.optional(v.array(v.enumOf(['succeeded', 'failed'])))
        })
      )
    )
    .do(async ctx => {
      let paginator = await callbackService.listCallbackDeliveryAttempts({
        tenant: ctx.tenant,
        callback: ctx.callback,
        destinationIds: ctx.input.destinationIds,
        status: ctx.input.status
      });

      let list = await paginator.run(ctx.input);
      return Paginator.presentLight(list, attempt =>
        eventDeliveryAttemptPresenter(attempt, { includePayload: false })
      );
    }),

  getDeliveryAttempt: callbackApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackId: v.string(),
        eventDeliveryAttemptId: v.string()
      })
    )
    .do(async ctx => {
      let attempt = await callbackService.getCallbackDeliveryAttempt({
        tenant: ctx.tenant,
        callback: ctx.callback,
        eventDeliveryAttemptId: ctx.input.eventDeliveryAttemptId
      });

      return eventDeliveryAttemptPresenter(attempt, { includePayload: true });
    })
});
