import { mtMap } from '@metorial/util-resource-mapper';

export type IncomingWebhooksGetOutput = {
  object: 'incoming_webhook';
  id: string;
  status: string;
  attemptCount: number;
  webhookRegistrationId: string | null;
  providerId: string;
  receivedAt: Date;
  details: {
    object: 'incoming_webhook.details';
    method: string;
    url: string;
    headers: Record<string, string>;
    body: { encoding: 'base64'; content: string } | null;
  } | null;
};

export let mapIncomingWebhooksGetOutput =
  mtMap.object<IncomingWebhooksGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    attemptCount: mtMap.objectField('attempt_count', mtMap.passthrough()),
    webhookRegistrationId: mtMap.objectField(
      'webhook_registration_id',
      mtMap.passthrough()
    ),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    receivedAt: mtMap.objectField('received_at', mtMap.date()),
    details: mtMap.objectField(
      'details',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        method: mtMap.objectField('method', mtMap.passthrough()),
        url: mtMap.objectField('url', mtMap.passthrough()),
        headers: mtMap.objectField('headers', mtMap.passthrough()),
        body: mtMap.objectField(
          'body',
          mtMap.object({
            encoding: mtMap.objectField('encoding', mtMap.passthrough()),
            content: mtMap.objectField('content', mtMap.passthrough())
          })
        )
      })
    )
  });

