import { env } from '../env';

export type TriggerWebhookRequestPayload = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: { encoding: 'base64'; content: string } | null;
};

export let getTriggerWebhookBaseUrl = (receiverTriggerId: string) => {
  let base = env.service.SERVICE_PUBLIC_URL.replace(/\/$/, '');
  return `${base}/slates-hub/triggers/webhook/${receiverTriggerId}`;
};

export let getReceiverWebhookBaseUrl = (receiverId: string) => {
  let base = env.service.SERVICE_PUBLIC_URL.replace(/\/$/, '');
  return `${base}/slates-hub/triggers/receiver-webhook/${receiverId}`;
};

export let getTriggerWebhookRequestStorageKey = (requestId: string) => {
  return `trigger-webhooks/${requestId}/request`;
};
