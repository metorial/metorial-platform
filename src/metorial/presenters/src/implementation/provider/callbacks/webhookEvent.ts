import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { webhookEventType } from '../../../types';

export let v1WebhookEventPresenter = Presenter.create(webhookEventType)
  .presenter(async ({ webhookEvent }) => ({
    object: 'webhook_event' as const,

    id: webhookEvent.id,
    status: webhookEvent.status,
    attempt_count: webhookEvent.attemptCount,

    webhook_registration_id: webhookEvent.webhookRegistration?.id ?? null,
    provider_id: webhookEvent.provider.id,

    request: webhookEvent.request
      ? {
          object: 'webhook_event.request' as const,
          method: webhookEvent.request.method,
          url: webhookEvent.request.url,
          headers: webhookEvent.request.headers,
          body: webhookEvent.request.body
        }
      : null,

    received_at: webhookEvent.receivedAt
  }))
  .schema(
    v.object({
      object: v.literal('webhook_event', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: 'Unique webhook event identifier',
        examples: ['swe_7dEfGhJkLmNpQrSt']
      }),

      status: v.string({
        name: 'status',
        description:
          'Processing status of the inbound webhook, as reported by the provider backend',
        examples: ['succeeded']
      }),

      attempt_count: v.number({
        name: 'attempt_count',
        description: 'Number of processing attempts made for this webhook event',
        examples: [1]
      }),

      webhook_registration_id: v.nullable(
        v.string({
          name: 'webhook_registration_id',
          description:
            'Your webhook registration this event was received on. Null when the event arrived on an endpoint Metorial operates for the provider: you can see it because it produced a callback event of yours, but there is no registration of your own behind it.',
          examples: ['whr_4dEfGhJkLmNpQrSt']
        })
      ),

      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider the receiving endpoint belongs to',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),

      request: v.nullable(
        v.object(
          {
            object: v.literal('webhook_event.request', {
              description: "String representing the object's type"
            }),

            method: v.string({
              name: 'method',
              description: 'HTTP method of the inbound request',
              examples: ['POST']
            }),

            url: v.string({
              name: 'url',
              description: 'URL the inbound request was sent to',
              examples: ['https://callbacks.metorial.com/w/whk_7dEfGhJkLmNpQrSt']
            }),

            headers: v.record(v.string(), {
              name: 'headers',
              description: 'Headers of the inbound request',
              examples: [{ 'content-type': 'application/json' }]
            }),

            body: v.nullable(
              v.object(
                {
                  encoding: v.literal('base64', {
                    description: 'Encoding used for the request body'
                  }),
                  content: v.string({
                    name: 'content',
                    description: 'Base64-encoded request body',
                    examples: ['eyJhY3Rpb24iOiJvcGVuZWQifQ==']
                  })
                },
                {
                  name: 'body',
                  description: 'Raw body of the inbound request'
                }
              )
            )
          },
          {
            name: 'request',
            description: 'The inbound HTTP request as it was received'
          }
        )
      ),

      received_at: v.date({
        name: 'received_at',
        description: 'Timestamp when the webhook was received',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
