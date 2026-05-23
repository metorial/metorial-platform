import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { slateTriggerDeliveryService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let slateTriggerDeliveryController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          triggerReceiverId: v.optional(v.string()),
          triggerReceiverIds: v.optional(v.array(v.string())),
          triggerEventIds: v.optional(v.array(v.string())),
          destinationIds: v.optional(v.array(v.string())),
          status: v.optional(v.array(v.enumOf(['pending', 'delivered', 'failed', 'retrying'])))
        })
      )
    )
    .do(async ctx =>
      slateTriggerDeliveryService.listTriggerDeliveries({
        tenant: ctx.tenant,
        input: ctx.input
      })
    ),

  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        eventDeliveryIntentId: v.string()
      })
    )
    .do(async ctx =>
      slateTriggerDeliveryService.getDelivery({
        tenant: ctx.tenant,
        eventDeliveryIntentId: ctx.input.eventDeliveryIntentId
      })
    ),

  listAttempts: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          triggerReceiverId: v.optional(v.string()),
          triggerReceiverIds: v.optional(v.array(v.string())),
          triggerEventIds: v.optional(v.array(v.string())),
          destinationIds: v.optional(v.array(v.string())),
          status: v.optional(v.array(v.enumOf(['failed', 'succeeded'])))
        })
      )
    )
    .do(async ctx => {
      return await slateTriggerDeliveryService.listTriggerDeliveryAttempts({
        tenant: ctx.tenant,
        input: ctx.input
      });
    }),

  getAttempt: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        eventDeliveryAttemptId: v.string()
      })
    )
    .do(async ctx =>
      slateTriggerDeliveryService.getTriggerDeliveryAttempt({
        tenant: ctx.tenant,
        eventDeliveryAttemptId: ctx.input.eventDeliveryAttemptId
      })
    )
});
