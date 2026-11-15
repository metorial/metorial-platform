import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { consumerDeviceTelemetryTokenType } from '../../types';

export let v1ConsumerDeviceTelemetryTokenPresenter = Presenter.create(
  consumerDeviceTelemetryTokenType
)
  .presenter(async ({ consumerDevice, ingestToken, secret, ingestUrl, expiresAt }) => ({
    object: 'consumer.device.telemetry_token' as const,

    consumer_device_id: consumerDevice.id,

    token: secret,
    token_id: ingestToken.groundstationIngestTokenId,
    ingest_url: ingestUrl,

    expires_at: expiresAt,
    created_at: ingestToken.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.device.telemetry_token'),
      consumer_device_id: v.string({
        name: 'consumer_device_id',
        description: 'The ID of the device the token is bound to.'
      }),
      token: v.string({
        name: 'token',
        description:
          'The ingest token secret. Returned only when the token is issued; store it on the device.'
      }),
      token_id: v.string({
        name: 'token_id',
        description: 'The ID of the ingest token. Not a secret.'
      }),
      ingest_url: v.string({
        name: 'ingest_url',
        description: 'The base URL the device sends agent telemetry to with this token.',
        examples: ['https://ingest.groundstation.metorial.com']
      }),
      expires_at: v.nullable(
        v.date({
          name: 'expires_at',
          description: 'When the token expires, or null if it stays valid until it is rotated.'
        })
      ),
      created_at: v.date({ name: 'created_at', description: 'When the token was issued.' })
    })
  )
  .build();
