import { v } from '@lowerdeck/validation';
import { callbackEventInternalService } from '@metorial-subspace/module-callback';
import { receiveSlatesCallbackEvent } from '@metorial-subspace/provider-slates';
import { app } from './_app';

export let callbackEventController = app.controller({
  receive: app
    .handler()
    .input(
      v.object({
        tenantIdentifier: v.string(),
        callbackId: v.string(),
        callbackInstanceId: v.string(),
        triggerEventId: v.string(),
        triggerRegistrationId: v.string(),
        triggerGroupKey: v.string(),
        triggerKey: v.string(),
        source: v.enumOf(['webhook', 'polling']),
        webhookEventId: v.optional(v.string()),
        mappedType: v.optional(v.string()),
        mappedId: v.optional(v.string()),
        occurredAt: v.date()
      })
    )
    .do(
      async ctx =>
        await receiveSlatesCallbackEvent(ctx.input, {
          recordEvent: d => callbackEventInternalService.recordEvent(d)
        })
    )
});
