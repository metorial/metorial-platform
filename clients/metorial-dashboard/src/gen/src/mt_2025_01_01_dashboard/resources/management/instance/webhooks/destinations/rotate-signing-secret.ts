import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceWebhooksDestinationsRotateSigningSecretOutput = {
  object: 'webhook.destination_signing_secret';
  webhookDestinationId: string;
  signingSecret: string;
  rotatedAt: Date;
};

export let mapManagementInstanceWebhooksDestinationsRotateSigningSecretOutput =
  mtMap.object<ManagementInstanceWebhooksDestinationsRotateSigningSecretOutput>(
    {
      object: mtMap.objectField('object', mtMap.passthrough()),
      webhookDestinationId: mtMap.objectField(
        'webhook_destination_id',
        mtMap.passthrough()
      ),
      signingSecret: mtMap.objectField('signing_secret', mtMap.passthrough()),
      rotatedAt: mtMap.objectField('rotated_at', mtMap.date())
    }
  );

