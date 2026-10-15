import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceIncomingWebhooksGetOutput = {
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

export let mapManagementInstanceIncomingWebhooksGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceIncomingWebhooksGetOutput>(
    ['attempt_count', 'webhook_registration_id', 'provider_id', 'received_at'],
    1
  );
