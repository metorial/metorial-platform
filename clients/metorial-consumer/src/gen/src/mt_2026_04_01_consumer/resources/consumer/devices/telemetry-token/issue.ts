import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ConsumerDevicesTelemetryTokenIssueOutput = {
  object: 'consumer.device.telemetry_token';
  consumerDeviceId: string;
  token: string;
  tokenId: string;
  ingestUrl: string;
  expiresAt: Date | null;
  createdAt: Date;
};

export let mapConsumerDevicesTelemetryTokenIssueOutput =
  /* @__PURE__ */ mapObject<ConsumerDevicesTelemetryTokenIssueOutput>(
    [
      'consumer_device_id',
      'token_id',
      'ingest_url',
      'expires_at',
      'created_at'
    ],
    1
  );
