import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { callbackDestinationSigningSecretType } from '../../../types';

export let v1CallbackDestinationSigningSecretPresenter = Presenter.create(
  callbackDestinationSigningSecretType
)
  .presenter(async ({ callbackDestinationSigningSecret }) => ({
    object: 'callback.destination_signing_secret' as const,
    callback_destination_id: callbackDestinationSigningSecret.callbackDestinationId,
    signing_secret: callbackDestinationSigningSecret.signingSecret,
    rotated_at: callbackDestinationSigningSecret.rotatedAt
  }))
  .schema(
    v.object({
      object: v.literal('callback.destination_signing_secret'),
      callback_destination_id: v.string(),
      signing_secret: v.string({
        description:
          'New callback signing secret. It is returned only by the immediate rotation response.'
      }),
      rotated_at: v.date()
    })
  )
  .build();
