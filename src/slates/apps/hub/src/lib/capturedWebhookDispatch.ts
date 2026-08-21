import { parseWebhookWireRequest, type WebhookWireRequest } from './webhookWire';

/**
 * The secure queue-to-handler boundary. Parsing happens again after authenticated payload
 * decryption so neither Fetch Request objects nor legacy normalized records can cross it.
 */
export let dispatchCapturedWebhookWireRequest = async <Response>(d: {
  request: unknown;
  handle: (request: WebhookWireRequest) => Promise<Response>;
}) => await d.handle(parseWebhookWireRequest(d.request));
