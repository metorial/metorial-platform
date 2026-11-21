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
        description: 'String representing the object’s type.'
      }),

      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['swe_7dEfGhJkLmNpQrSt']
      }),

      status: v.string({
        name: 'status',
        description:
          'Processing status of the inbound webhook. `failed_retrying` while delivery is retried, `failed_final` once retries are exhausted.',
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
            'Your webhook registration this request was received on. `null` when it arrived on an endpoint Metorial operates for the provider after producing one of your callback events.',
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
        description: 'Time the webhook arrived.',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
