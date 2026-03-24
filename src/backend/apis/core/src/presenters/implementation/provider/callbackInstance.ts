import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { callbackInstanceType } from '../../types';

let callbackInstanceTriggerSchema = v.object({
  object: v.literal('callback.instance.trigger'),
  id: v.string(),
  source: v.string(),
  poll_interval_seconds: v.nullable(v.number()),
  next_poll_at: v.nullable(v.date()),
  last_polled_at: v.nullable(v.date()),
  webhook_url: v.nullable(v.string()),
  is_webhook_registered: v.boolean(),
  provider_trigger: v.nullable(v.any())
});

export let v1CallbackInstancePresenter = Presenter.create(callbackInstanceType)
  .presenter(async ({ callbackInstance }) => ({
    object: 'callback.instance' as const,
    id: callbackInstance.id,
    status: callbackInstance.status,
    registration_status: callbackInstance.registrationStatus,
    triggers: callbackInstance.triggers.map(trigger => ({
      object: 'callback.instance.trigger' as const,
      id: trigger.id,
      source: trigger.source,
      poll_interval_seconds: trigger.pollIntervalSeconds,
      next_poll_at: trigger.nextPollAt,
      last_polled_at: trigger.lastPolledAt,
      webhook_url: trigger.webhookUrl,
      is_webhook_registered: trigger.isWebhookRegistered,
      provider_trigger: trigger.providerTrigger
    })),
    created_at: callbackInstance.createdAt,
    updated_at: callbackInstance.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('callback.instance'),
      id: v.string(),
      status: v.enumOf(['attached', 'detached']),
      registration_status: v.enumOf(['pending', 'registered']),
      triggers: v.array(callbackInstanceTriggerSchema),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
