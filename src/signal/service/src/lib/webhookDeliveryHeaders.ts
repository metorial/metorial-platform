let TRANSPORT_CONTROLLED_HEADERS = new Set([
  'connection',
  'content-length',
  'content-type',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'user-agent'
]);

let METORIAL_DELIVERY_HEADERS = new Set([
  'metorial-delivery-attempt',
  'metorial-event-id',
  'metorial-notification-id',
  'metorial-sender',
  'metorial-signature',
  'metorial-version',
  'metorial-webhook-id'
]);

export let buildWebhookDeliveryHeaders = (d: {
  eventHeaders: readonly (readonly [string, string])[];
  webhookId: string;
  notificationId: string;
  eventId: string;
  signature: string;
  attemptNumber: number;
  sender: string;
}) => {
  let forwarded: Record<string, string> = {};
  for (let [name, value] of d.eventHeaders) {
    let normalized = name.toLowerCase();
    if (
      !TRANSPORT_CONTROLLED_HEADERS.has(normalized) &&
      !METORIAL_DELIVERY_HEADERS.has(normalized)
    ) {
      forwarded[name] = value;
    }
  }

  return {
    ...forwarded,
    'Content-Type': 'application/json',
    'User-Agent': 'Metorial (https://metorial.com)',
    'Metorial-Webhook-Id': d.webhookId,
    'Metorial-Notification-Id': d.notificationId,
    'Metorial-Event-Id': d.eventId,
    'Metorial-Signature': d.signature,
    'Metorial-Version': '2025-01-01',
    'Metorial-Delivery-Attempt': String(d.attemptNumber),
    'Metorial-Sender': d.sender
  };
};
