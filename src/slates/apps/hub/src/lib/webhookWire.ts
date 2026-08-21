import { createHash } from 'node:crypto';
import {
  encodeCanonicalWebhookWireRequestV1,
  hashWebhookWireRequestV1,
  parseWebhookWireRequest,
  SLATE_WEBHOOK_CANONICAL_WIRE_VERSION,
  type WebhookWireRequest
} from '@slates/proto';

/** Hub is a consumer of the protocol wire contract; it does not own another encoding. */
export {
  encodeCanonicalWebhookWireRequestV1,
  hashWebhookWireRequestV1,
  parseWebhookWireRequest,
  SLATE_WEBHOOK_CANONICAL_WIRE_VERSION,
  webhookWireRequest,
  type WebhookWireRequest
} from '@slates/proto';

export let WEBHOOK_WIRE_VERSION = SLATE_WEBHOOK_CANONICAL_WIRE_VERSION;
export let encodeWebhookWireRequest = encodeCanonicalWebhookWireRequestV1;
export let computeWebhookWireRequestHash = hashWebhookWireRequestV1;

export let serializeWebhookWireRequest = (request: WebhookWireRequest) =>
  new TextEncoder().encode(JSON.stringify(parseWebhookWireRequest(request)));

export let deserializeWebhookWireRequest = (encoded: Uint8Array) =>
  parseWebhookWireRequest(
    JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(encoded))
  );

export let computeWebhookWireBodyHash = (request: WebhookWireRequest) =>
  createHash('sha256')
    .update(
      request.body.present
        ? Buffer.from(request.body.base64, 'base64')
        : Buffer.from('metorial.webhook-wire\0body-absent\0v1\0')
    )
    .digest('hex');

/** Converts the lossless ingress contract only at the provider invocation boundary. */
export let adaptWebhookWireRequestForProviderInvocation = (request: WebhookWireRequest) => ({
  url: request.url,
  method: request.method,
  headers: Object.fromEntries(request.headers),
  body: request.body.present
    ? { encoding: 'base64' as const, content: request.body.base64 }
    : null
});
