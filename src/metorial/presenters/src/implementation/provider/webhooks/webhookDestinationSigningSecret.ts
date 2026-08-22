import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { webhookDestinationSigningSecretType } from '../../../types';

export let v1WebhookDestinationSigningSecretPresenter = Presenter.create(
  webhookDestinationSigningSecretType
)
  .presenter(async ({ webhookDestinationSigningSecret }) => ({
    object: 'webhook.destination_signing_secret' as const,
    webhook_destination_id: webhookDestinationSigningSecret.webhookDestinationId,
    signing_secret: webhookDestinationSigningSecret.signingSecret,
    rotated_at: webhookDestinationSigningSecret.rotatedAt
  }))
  .schema(
    v.object({
      object: v.literal('webhook.destination_signing_secret'),
      webhook_destination_id: v.string(),
      signing_secret: v.string({
        description:
          'New webhook signing secret. It is returned only by the immediate rotation response.'
      }),
      rotated_at: v.date()
    })
  )
  .build();
