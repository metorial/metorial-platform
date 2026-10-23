import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { eventDeliveryType } from '../../types';
import { v1EventDeliveryAttemptPresenter } from './eventDeliveryAttempt';

export let v1EventDeliveryPresenter = Presenter.create(eventDeliveryType)
  .presenter(async ({ eventDelivery, organization }, opts) => ({
    object: 'event.delivery',
    id: eventDelivery.id,
    organization_id: organization.id,
    instance_id: eventDelivery.instance?.id ?? null,

    event_id: eventDelivery.systemEvent.id,
    event_type: eventDelivery.systemEvent.eventType,
    event_destination_id: eventDelivery.eventDestination.id,

    type: eventDelivery.type,
    status: eventDelivery.status,
    attempt_count: eventDelivery.attemptCount,

    error: eventDelivery.errorCode
      ? {
          code: eventDelivery.errorCode,
          message: eventDelivery.errorMessage ?? eventDelivery.errorCode
        }
      : null,

    retry: {
      strategy: eventDelivery.retryStrategy,
      max_attempts: eventDelivery.retryMaxAttempts,
      base_delay_seconds: eventDelivery.retryBaseDelaySeconds,
      max_delay_seconds: eventDelivery.retryMaxDelaySeconds
    },

    attempts: await Promise.all(
      eventDelivery.attempts.map(attempt =>
        v1EventDeliveryAttemptPresenter
          .present(
            {
              attempt: {
                ...attempt,
                intent: {
                  ...eventDelivery,
                  systemEvent: eventDelivery.systemEvent,
                  eventDestination: eventDelivery.eventDestination
                }
              }
            },
            opts
          )
          .run()
      )
    ),

    last_attempt_at: eventDelivery.lastAttemptAt ?? null,
    next_attempt_at: eventDelivery.nextAttemptAt ?? null,
    completed_at: eventDelivery.completedAt ?? null,
    created_at: eventDelivery.createdAt,
    updated_at: eventDelivery.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('event.delivery'),
      id: v.string({
        description: 'Unique identifier for the delivery',
        examples: ['evdi_1aBcDeFgHjKlMnPq']
      }),
      organization_id: v.string({
        description: 'The organization this delivery belongs to',
        examples: ['org_1aBcDeFgHjKlMnPq']
      }),
      instance_id: v.nullable(
        v.string({
          description: 'The instance the delivered event occurred in, if any',
          examples: ['ins_1aBcDeFgHjKlMnPq']
        })
      ),
      event_id: v.string({
        description: 'The event being delivered',
        examples: ['evnt_1aBcDeFgHjKlMnPq']
      }),
      event_type: v.string({
        description: 'Type of the event being delivered',
        examples: ['organization.created']
      }),
      event_destination_id: v.string({
        description: 'The event destination this delivery targets',
        examples: ['evtd_1aBcDeFgHjKlMnPq']
      }),
      type: v.literal('webhook', {
        description:
          'The delivery mechanism used. Only "webhook" is currently supported; a delivery keeps the mechanism it was created with.'
      }),
      status: v.enumOf(['pending', 'retrying', 'delivered', 'failed', 'cancelled'], {
        description:
          'Lifecycle of the delivery. `retrying` means at least one attempt failed transiently and another is scheduled; `cancelled` means the destination was archived before the delivery completed.'
      }),
      attempt_count: v.number({
        description: 'How many attempts have been made so far',
        examples: [2]
      }),
      error: v.nullable(
        v.object(
          {
            code: v.string({
              description: 'Machine-readable code from the most recent failed attempt',
              examples: ['http_503']
            }),
            message: v.string({
              description: 'Human-readable description of the most recent failure',
              examples: ['Destination responded with HTTP 503']
            })
          },
          { description: 'The most recent failure, or `null` if no attempt has failed' }
        )
      ),
      retry: v.object(
        {
          strategy: v.enumOf(['exponential', 'linear', 'fixed'], {
            description: 'How the delay between attempts grows'
          }),
          max_attempts: v.number({
            description: 'How many attempts this delivery may make in total',
            examples: [8]
          }),
          base_delay_seconds: v.number({
            description: 'Delay the backoff curve starts from',
            examples: [10]
          }),
          max_delay_seconds: v.number({
            description: 'Ceiling the backoff delay is clamped to',
            examples: [10800]
          })
        },
        {
          description:
            "The retry policy captured from the destination when the delivery was scheduled. Editing the destination does not change an already-scheduled delivery's policy."
        }
      ),
      attempts: v.array(v1EventDeliveryAttemptPresenter.schema, {
        description:
          'Every attempt made for this delivery, oldest first. Request and response bodies are omitted here — read an individual attempt to get them.'
      }),
      last_attempt_at: v.nullable(
        v.date({ description: 'When the most recent attempt finished' })
      ),
      next_attempt_at: v.nullable(
        v.date({
          description: 'When the next attempt is scheduled, while the delivery is retrying'
        })
      ),
      completed_at: v.nullable(
        v.date({ description: 'When the delivery reached a terminal state' })
      ),
      created_at: v.date({ description: 'When the delivery was scheduled' }),
      updated_at: v.date({ description: 'When the delivery was last updated' })
    })
  )
  .build();
