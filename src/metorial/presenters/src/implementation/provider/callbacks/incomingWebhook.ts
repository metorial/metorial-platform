import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { incomingWebhookType } from '../../../types';

export let v1IncomingWebhookPresenter = Presenter.create(incomingWebhookType)
  .presenter(async ({ incomingWebhook }) => ({
    object: 'incoming_webhook' as const,

    id: incomingWebhook.id,
    status: incomingWebhook.status,
    attempt_count: incomingWebhook.attemptCount,

    webhook_registration_id: incomingWebhook.webhookRegistration?.id ?? null,
    provider_id: incomingWebhook.provider.id,

    received_at: incomingWebhook.receivedAt
  }))
  .schema(
    v.object({
      object: v.literal('incoming_webhook', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: 'Unique incoming webhook identifier',
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
        description: 'Number of processing attempts made for this incoming webhook',
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

      received_at: v.date({
        name: 'received_at',
        description: 'Timestamp when the webhook was received',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
