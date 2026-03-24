import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { callbackNotificationType } from '../../types';

let callbackNotificationDestinationSchema = v.object({
  object: v.literal('callback.notification.destination'),
  id: v.string(),
  name: v.string(),
  description: v.nullable(v.string()),
  type: v.string(),
  event_types: v.array(v.string()),
  retry: v.any(),
  webhook: v.nullable(
    v.object({
      id: v.string(),
      url: v.string(),
      method: v.string(),
      created_at: v.date()
    })
  ),
  created_at: v.date(),
  updated_at: v.date()
});

let callbackNotificationEventSchema = v.object({
  object: v.literal('callback.notification.event'),
  id: v.string(),
  type: v.string(),
  topics: v.array(v.string()),
  status: v.string(),
  destination_count: v.number(),
  success_count: v.number(),
  failure_count: v.number(),
  request: v.any(),
  created_at: v.date(),
  updated_at: v.date()
});

export let v1CallbackNotificationPresenter = Presenter.create(callbackNotificationType)
  .presenter(async ({ callbackNotification }) => ({
    object: 'callback.notification' as const,
    id: callbackNotification.id,
    status: callbackNotification.status,
    error: callbackNotification.error,
    attempt_count: callbackNotification.attemptCount,
    event: {
      object: 'callback.notification.event' as const,
      id: callbackNotification.event.id,
      type: callbackNotification.event.type,
      topics: callbackNotification.event.topics,
      status: callbackNotification.event.status,
      destination_count: callbackNotification.event.destinationCount,
      success_count: callbackNotification.event.successCount,
      failure_count: callbackNotification.event.failureCount,
      request: callbackNotification.event.request,
      created_at: callbackNotification.event.createdAt,
      updated_at: callbackNotification.event.updatedAt
    },
    destination: {
      object: 'callback.notification.destination' as const,
      id: callbackNotification.destination.id,
      name: callbackNotification.destination.name,
      description: callbackNotification.destination.description,
      type: callbackNotification.destination.type,
      event_types: callbackNotification.destination.eventTypes,
      retry: callbackNotification.destination.retry,
      webhook: callbackNotification.destination.webhook
        ? {
            id: callbackNotification.destination.webhook.id,
            url: callbackNotification.destination.webhook.url,
            method: callbackNotification.destination.webhook.method,
            created_at: callbackNotification.destination.webhook.createdAt
          }
        : null,
      created_at: callbackNotification.destination.createdAt,
      updated_at: callbackNotification.destination.updatedAt
    },
    created_at: callbackNotification.createdAt,
    updated_at: callbackNotification.updatedAt,
    last_attempt_at: callbackNotification.lastAttemptAt,
    next_attempt_at: callbackNotification.nextAttemptAt
  }))
  .schema(
    v.object({
      object: v.literal('callback.notification'),
      id: v.string(),
      status: v.string(),
      error: v.nullable(v.any()),
      attempt_count: v.number(),
      event: callbackNotificationEventSchema,
      destination: callbackNotificationDestinationSchema,
      created_at: v.date(),
      updated_at: v.date(),
      last_attempt_at: v.nullable(v.date()),
      next_attempt_at: v.nullable(v.date())
    })
  )
  .build();
