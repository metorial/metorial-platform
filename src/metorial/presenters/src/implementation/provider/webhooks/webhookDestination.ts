import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { webhookDestinationType } from '../../../types';

export let v1WebhookDestinationPresenter = Presenter.create(webhookDestinationType)
  .presenter(async ({ webhookDestination }) => {
    let enriched = webhookDestination as typeof webhookDestination & {
      signalDestination?: {
        webhook?: { signingSecretConfigured?: boolean } | null;
      } | null;
    };

    return {
      object: 'webhook.destination' as const,
      id: webhookDestination.id,
      status: webhookDestination.status,
      name: webhookDestination.name,
      description: webhookDestination.description,
      metadata: webhookDestination.metadata,
      url: webhookDestination.url,
      method: webhookDestination.method,
      signing_secret_configured:
        enriched.signalDestination?.webhook?.signingSecretConfigured ?? false,
      created_at: webhookDestination.createdAt,
      updated_at: webhookDestination.updatedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('webhook.destination', {
        description: "String representing the object's type"
      }),
      id: v.string({ description: 'Unique webhook destination identifier' }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        description: 'Webhook destination lifecycle status'
      }),
      name: v.string({ description: 'Display name for the webhook destination' }),
      description: v.nullable(v.string({ description: 'Optional destination description' })),
      metadata: v.nullable(v.record(v.any(), { description: 'Custom destination metadata' })),
      url: v.string({ description: 'Webhook URL that receives deliveries' }),
      method: v.enumOf(['POST', 'PUT', 'PATCH'] as const, {
        description: 'HTTP method used for webhook delivery'
      }),
      signing_secret_configured: v.boolean({
        description: 'Whether the webhook destination has an outbound signing secret'
      }),
      created_at: v.date({ description: 'Timestamp when the destination was created' }),
      updated_at: v.date({ description: 'Timestamp when the destination was last updated' })
    })
  )
  .build();
