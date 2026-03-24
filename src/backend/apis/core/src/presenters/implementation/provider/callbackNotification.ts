import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { callbackNotificationType } from '../../types';

let callbackNotificationDestinationSchema = v.object({
  object: v.literal('callback.notification.destination', {
    description: "String representing the object's type"
  }),
  id: v.string({
    name: 'id',
    description: 'Destination identifier used for this callback notification',
    examples: ['dest_4dEfGhJkLmNpQrSt']
  }),
  name: v.string({
    name: 'name',
    description: 'Destination display name',
    examples: ['Primary Webhook Endpoint']
  }),
  description: v.nullable(
    v.string({
      name: 'description',
      description: 'Optional destination description',
      examples: ['Primary production webhook receiver']
    })
  ),
  type: v.string({
    name: 'type',
    description: 'Delivery destination type',
    examples: ['webhook']
  }),
  event_types: v.array(
    v.string({
      examples: ['message.created']
    }),
    {
      name: 'event_types',
      description: 'Event types this destination accepted for the notification'
    }
  ),
  retry: v.any({
    name: 'retry',
    description: 'Retry configuration applied to this destination'
  }),
  webhook: v.nullable(
    v.object(
      {
        id: v.string({
          name: 'id',
          description: 'Webhook identifier',
          examples: ['wh_4dEfGhJkLmNpQrSt']
        }),
        url: v.string({
          name: 'url',
          description: 'Webhook URL used for the notification',
          examples: ['https://api.example.com/webhooks/metorial']
        }),
        method: v.string({
          name: 'method',
          description: 'HTTP method used for delivery',
          examples: ['POST']
        }),
        created_at: v.date({
          name: 'created_at',
          description: 'Timestamp when the webhook destination was created',
          examples: [new Date('2025-09-15T10:30:00Z')]
        })
      },
      { name: 'webhook', description: 'Webhook destination details' }
    )
  ),
  created_at: v.date({
    name: 'created_at',
    description: 'Timestamp when the destination was created',
    examples: [new Date('2025-09-15T10:30:00Z')]
  }),
  updated_at: v.date({
    name: 'updated_at',
    description: 'Timestamp when the destination was last updated',
    examples: [new Date('2026-01-10T14:45:00Z')]
  })
});

let callbackNotificationEventSchema = v.object({
  object: v.literal('callback.notification.event', {
    description: "String representing the object's type"
  }),
  id: v.string({
    name: 'id',
    description: 'Underlying event identifier for this notification',
    examples: ['evt_4dEfGhJkLmNpQrSt']
  }),
  type: v.string({
    name: 'type',
    description: 'Event type delivered to the destination',
    examples: ['message.created']
  }),
  topics: v.array(
    v.string({
      examples: ['messages']
    }),
    {
      name: 'topics',
      description: 'Topics associated with the event'
    }
  ),
  status: v.string({
    name: 'status',
    description: 'Aggregate delivery status for the underlying event',
    examples: ['delivered']
  }),
  destination_count: v.number({
    name: 'destination_count',
    description: 'Total number of destinations targeted by the event'
  }),
  success_count: v.number({
    name: 'success_count',
    description: 'Number of successful deliveries for the event'
  }),
  failure_count: v.number({
    name: 'failure_count',
    description: 'Number of failed deliveries for the event'
  }),
  request: v.any({
    name: 'request',
    description: 'Serialized request payload generated for the event'
  }),
  created_at: v.date({
    name: 'created_at',
    description: 'Timestamp when the event was created',
    examples: [new Date('2025-09-15T10:30:00Z')]
  }),
  updated_at: v.date({
    name: 'updated_at',
    description: 'Timestamp when the event was last updated',
    examples: [new Date('2026-01-10T14:45:00Z')]
  })
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
      object: v.literal('callback.notification', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique callback notification identifier',
        examples: ['cbn_4dEfGhJkLmNpQrSt']
      }),
      status: v.string({
        name: 'status',
        description: 'Current notification delivery status',
        examples: ['delivered']
      }),
      error: v.nullable(
        v.any({
          name: 'error',
          description: 'Last known delivery error payload, if any'
        })
      ),
      attempt_count: v.number({
        name: 'attempt_count',
        description: 'Number of delivery attempts made for this notification'
      }),
      event: callbackNotificationEventSchema,
      destination: callbackNotificationDestinationSchema,
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the notification was created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the notification was last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      }),
      last_attempt_at: v.nullable(
        v.date({
          name: 'last_attempt_at',
          description: 'Timestamp of the most recent delivery attempt',
          examples: [new Date('2026-01-10T14:45:00Z')]
        })
      ),
      next_attempt_at: v.nullable(
        v.date({
          name: 'next_attempt_at',
          description: 'Timestamp of the next scheduled retry attempt, if any',
          examples: [new Date('2026-01-10T14:50:00Z')]
        })
      )
    })
  )
  .build();
