import type { VersionedEncryptionKeyring } from '@lowerdeck/encryption';
import { createHubVersionedEncryptionKeyring } from '../encryption';
import {
  deserializeWebhookWireRequest,
  serializeWebhookWireRequest,
  type WebhookWireRequest
} from '../lib/webhookWire';

export let WEBHOOK_PAYLOAD_VERSION = 1;
export let WEBHOOK_PAYLOAD_AAD_VERSION = 1;
export let WEBHOOK_PAYLOAD_RETENTION_MS = 24 * 60 * 60 * 1000;
export let WEBHOOK_PAYLOAD_TERMINAL_RETENTION_MS = 60 * 60 * 1000;

let closedContext = (values: readonly (string | number | bigint)[]) =>
  ['metorial', 'slates', 'webhook-request-payload', 'v1', ...values.map(String)]
    .map(value => `${Buffer.byteLength(value, 'utf8')}:${value}`)
    .join('|');

export let webhookRequestPayloadContext = (d: {
  tenantId: string;
  receiverId: string;
  requestId: string;
  purpose: 'accepted_webhook_request';
  payloadVersion: number;
  encryptionVersion: number;
  aadVersion: number;
}) => {
  if (d.payloadVersion !== WEBHOOK_PAYLOAD_VERSION || d.aadVersion !== 1) {
    throw new Error('Unsupported webhook request payload AAD grammar');
  }
  return closedContext([
    d.tenantId,
    d.receiverId,
    d.requestId,
    d.purpose,
    d.payloadVersion,
    d.encryptionVersion,
    d.aadVersion
  ]);
};

let getWebhookPayloadKeyring = () => createHubVersionedEncryptionKeyring();

export let encryptWebhookRequestPayload = async (d: {
  tenantId: string;
  receiverId: string;
  requestId: string;
  request: WebhookWireRequest;
}) => await createWebhookRequestPayloadCrypto(getWebhookPayloadKeyring()).encrypt(d);

export let decryptWebhookRequestPayloadEnvelope = async (d: {
  tenantId: string;
  receiverId: string;
  requestId: string;
  encryptedRequest: string;
  encryptionVersion: number;
  aadVersion: number;
}) => await createWebhookRequestPayloadCrypto(getWebhookPayloadKeyring()).decrypt(d);

export let createWebhookRequestPayloadCrypto = (keyring: VersionedEncryptionKeyring) => ({
  encrypt: async (d: {
    tenantId: string;
    receiverId: string;
    requestId: string;
    request: WebhookWireRequest;
    encryptionVersion?: number;
    aadVersion?: number;
  }) => {
    let encryptionVersion = d.encryptionVersion ?? keyring.activeKeyVersion;
    let aadVersion = d.aadVersion ?? WEBHOOK_PAYLOAD_AAD_VERSION;
    let encryptedRequest = await keyring.encrypt({
      secret: Buffer.from(serializeWebhookWireRequest(d.request)).toString('base64'),
      entityId: webhookRequestPayloadContext({
        tenantId: d.tenantId,
        receiverId: d.receiverId,
        requestId: d.requestId,
        purpose: 'accepted_webhook_request',
        payloadVersion: WEBHOOK_PAYLOAD_VERSION,
        encryptionVersion,
        aadVersion
      }),
      encryptionKeyVersion: encryptionVersion,
      aadVersion
    });
    return { encryptedRequest, encryptionVersion, aadVersion };
  },
  decrypt: async (d: {
    tenantId: string;
    receiverId: string;
    requestId: string;
    encryptedRequest: string;
    encryptionVersion: number;
    aadVersion: number;
  }) => {
    let encoded = await keyring.decrypt({
      encrypted: d.encryptedRequest,
      entityId: webhookRequestPayloadContext({
        tenantId: d.tenantId,
        receiverId: d.receiverId,
        requestId: d.requestId,
        purpose: 'accepted_webhook_request',
        payloadVersion: WEBHOOK_PAYLOAD_VERSION,
        encryptionVersion: d.encryptionVersion,
        aadVersion: d.aadVersion
      }),
      encryptionKeyVersion: d.encryptionVersion,
      aadVersion: d.aadVersion
    });
    return deserializeWebhookWireRequest(Buffer.from(encoded, 'base64'));
  }
});
