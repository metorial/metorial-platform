import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { callbackDestinationType } from '../../../types';

export let v1CallbackDestinationPresenter = Presenter.create(callbackDestinationType)
  .presenter(async ({ callbackDestination }) => ({
    object: 'callback.destination' as const,
    id: callbackDestination.id,
    status: callbackDestination.status,
    name: callbackDestination.name,
    description: callbackDestination.description,
    metadata: callbackDestination.metadata,
    url: callbackDestination.url,
    method: callbackDestination.method,
    signing_secret:
      (
        callbackDestination as typeof callbackDestination & {
          webhook?: {
            signatureToken?: string | null;
            signingSecret?: string | null;
          } | null;
        }
      ).webhook?.signatureToken ??
      (
        callbackDestination as typeof callbackDestination & {
          webhook?: {
            signatureToken?: string | null;
            signingSecret?: string | null;
          } | null;
        }
      ).webhook?.signingSecret ??
      null,
    created_at: callbackDestination.createdAt,
    updated_at: callbackDestination.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('callback.destination', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique callback destination identifier',
        examples: ['cld_7dEfGhJkLmNpQrSt']
      }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'Callback destination lifecycle status'
      }),
      name: v.string({
        name: 'name',
        description: 'Display name for the callback destination',
        examples: ['Primary Webhook Endpoint']
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Optional destination description',
          examples: ['Primary production webhook receiver']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs for storing additional destination metadata',
          examples: [{ region: 'us-east-1', owner: 'integrations-team' }]
        })
      ),
      url: v.string({
        name: 'url',
        description: 'Webhook URL that receives callback deliveries',
        examples: ['https://api.example.com/webhooks/metorial']
      }),
      method: v.string({
        name: 'method',
        description: 'HTTP method used for webhook delivery',
        examples: ['POST']
      }),
      signing_secret: v.nullable(
        v.string({
          name: 'signing_secret',
          description:
            'Secret used to verify callback webhook signatures. Populated on detailed destination responses when available.',
          examples: ['whsec_4dEfGhJkLmNpQrSt']
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the callback destination was created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the callback destination was last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
