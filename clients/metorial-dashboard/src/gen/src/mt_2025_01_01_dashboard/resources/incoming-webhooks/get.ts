import { mapObject } from '@metorial/util-resource-mapper/compact';

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
  /* @__PURE__ */ mapObject<IncomingWebhooksGetOutput>(
    ['attempt_count', 'webhook_registration_id', 'provider_id', 'received_at'],
    1
  );
