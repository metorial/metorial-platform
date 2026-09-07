import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { webhookRegistrationType } from '../../../types';
import { v1ProviderPreview } from '../provider';

export let v1WebhookRegistrationPresenter = Presenter.create(webhookRegistrationType)
  .presenter(async ({ webhookRegistration }) => ({
    object: 'webhook_registration' as const,

    id: webhookRegistration.id,
    status: webhookRegistration.status,

    name: webhookRegistration.name,
    description: webhookRegistration.description,
    metadata: webhookRegistration.metadata,

    receive_url: webhookRegistration.receiveUrl,

    setup: {
      object: 'webhook_registration.setup' as const,
      status:
        webhookRegistration.status === 'awaiting_setup'
          ? ('pending' as const)
          : ('completed' as const),
      document: webhookRegistration.setup?.document ?? null
    },

    provider: v1ProviderPreview(webhookRegistration.provider),

    created_at: webhookRegistration.createdAt,
    updated_at: webhookRegistration.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('webhook_registration', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: 'Unique webhook registration identifier',
        examples: ['whr_4dEfGhJkLmNpQrSt']
      }),

      status: v.enumOf(['awaiting_setup', 'active', 'archived', 'deleted'], {
        name: 'status',
        description:
          'Webhook registration lifecycle status. A registration only receives events once it is active.'
      }),

      name: v.string({
        name: 'name',
        description: 'Display name for the webhook registration',
        examples: ['Production GitHub Webhook']
      }),

      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Optional webhook registration description',
          examples: ['Receives repository events for the production workspace']
        })
      ),

      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description:
            'Custom key-value pairs for storing additional webhook registration metadata',
          examples: [{ environment: 'production', owner: 'platform-team' }]
        })
      ),

      receive_url: v.nullable(
        v.string({
          name: 'receive_url',
          description:
            'URL the provider should send webhooks to. Treat this as a secret - it is what authenticates inbound requests. Null until the registration has been created on the provider.',
          examples: ['https://triggers.metorial.com/w/whk_7dEfGhJkLmNpQrSt']
        })
      ),

      setup: v.object(
        {
          object: v.literal('webhook_registration.setup', {
            description: "String representing the object's type"
          }),

          status: v.enumOf(['pending', 'completed'], {
            name: 'status',
            description:
              'Whether the provider-side setup steps still have to be completed by submitting a user config'
          }),

          document: v.nullable(
            v.string({
              name: 'document',
              description:
                'Provider-supplied instructions describing how to finish registering the webhook',
              examples: ['Add the receive URL under Settings -> Webhooks.']
            })
          )
        },
        {
          name: 'setup',
          description: 'Provider-side setup state for this webhook registration'
        }
      ),

      provider: v1ProviderPreview.schema,

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the webhook registration was created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the webhook registration was last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
