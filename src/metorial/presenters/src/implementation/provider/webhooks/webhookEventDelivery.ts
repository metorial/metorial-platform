import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { webhookEventDeliveryType } from '../../../types';

let errorSchema = v.nullable(
  v.object({
    code: v.string(),
    message: v.string()
  })
);

let attemptSchema = v.object({
  object: v.literal('webhook.event.delivery.attempt'),
  id: v.string(),
  status: v.enumOf(['succeeded', 'failed'] as const),
  attempt_number: v.number(),
  duration_ms: v.number(),
  error: errorSchema,
  response: v.nullable(v.object({ status_code: v.number() })),
  created_at: v.date()
});

export let v1WebhookEventDeliveryPresenter = Presenter.create(webhookEventDeliveryType)
  .presenter(async ({ webhookEventDelivery }) => ({
    object: 'webhook.event.delivery' as const,
    id: webhookEventDelivery.id,
    status: webhookEventDelivery.status,
    error: webhookEventDelivery.error,
    attempt_count: webhookEventDelivery.attemptCount,
    destination: webhookEventDelivery.destination
      ? {
          object: 'webhook.destination.preview' as const,
          id: webhookEventDelivery.destination.id,
          name: webhookEventDelivery.destination.name,
          url: webhookEventDelivery.destination.url
        }
      : null,
    attempts: webhookEventDelivery.attempts.map(attempt => ({
      object: 'webhook.event.delivery.attempt' as const,
      id: attempt.id,
      status: attempt.status,
      attempt_number: attempt.attemptNumber,
      duration_ms: attempt.durationMs,
      error: attempt.error,
      response: attempt.response ? { status_code: attempt.response.statusCode } : null,
      created_at: attempt.createdAt
    })),
    last_attempt_at: webhookEventDelivery.lastAttemptAt,
    next_attempt_at: webhookEventDelivery.nextAttemptAt,
    created_at: webhookEventDelivery.createdAt,
    updated_at: webhookEventDelivery.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('webhook.event.delivery'),
      id: v.string(),
      status: v.enumOf(['pending', 'delivered', 'retrying', 'failed'] as const),
      error: errorSchema,
      attempt_count: v.number(),
      destination: v.nullable(
        v.object({
          object: v.literal('webhook.destination.preview'),
          id: v.string(),
          name: v.string(),
          url: v.string()
        })
      ),
      attempts: v.array(attemptSchema),
      last_attempt_at: v.nullable(v.date()),
      next_attempt_at: v.nullable(v.date()),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
