import { VersionedEncryptionKeyring } from '@lowerdeck/encryption';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({ db: {} }));
vi.mock('../queues/trigger/webhook', () => ({
  slateTriggerWebhookQueue: { add: vi.fn() }
}));

import { createWebhookRequestPayloadCrypto } from '../services/slateTriggerWebhookRequest';
import { dispatchCapturedWebhookWireRequest } from './capturedWebhookDispatch';
import type { WebhookWireRequest } from './webhookWire';

let crypto = () =>
  createWebhookRequestPayloadCrypto(
    new VersionedEncryptionKeyring({
      keys: { 1: 'capture-queue-handler-key' },
      activeKeyVersion: 1,
      supportedAadVersions: [1]
    })
  );

describe('secure captured webhook queue boundary', () => {
  it.each([
    {
      name: 'binary ordered duplicate headers',
      request: {
        url: 'https://hooks.test/callback?item=one&item=two',
        method: 'POST',
        headers: [
          ['X-Signature', 'first'],
          ['x-signature', 'second'],
          ['X-Comma', 'one,two']
        ],
        body: { present: true, base64: Buffer.from([0, 255, 13, 10]).toString('base64') }
      }
    },
    {
      name: 'absent body',
      request: {
        url: 'https://hooks.test/callback',
        method: 'POST',
        headers: [],
        body: { present: false }
      }
    },
    {
      name: 'present empty body',
      request: {
        url: 'https://hooks.test/callback',
        method: 'POST',
        headers: [],
        body: { present: true, base64: '' }
      }
    }
  ] as { name: string; request: WebhookWireRequest }[])(
    'preserves $name capture through encryption, queue dispatch, handler, and response',
    async ({ request }) => {
      let payloadCrypto = crypto();
      let encrypted = await payloadCrypto.encrypt({
        tenantId: 'tenant-1',
        receiverId: 'receiver-1',
        requestId: 'request-1',
        request
      });
      let decrypted = await payloadCrypto.decrypt({
        tenantId: 'tenant-1',
        receiverId: 'receiver-1',
        requestId: 'request-1',
        ...encrypted
      });
      let response = {
        status: 202,
        body: request.body,
        echoedHeaders: request.headers
      };
      let handler = vi.fn(async (received: WebhookWireRequest) => response);

      await expect(
        dispatchCapturedWebhookWireRequest({ request: decrypted, handle: handler })
      ).resolves.toEqual(response);
      expect(handler).toHaveBeenCalledWith(request);
    }
  );

  it.each([
    new Request('https://hooks.test/callback'),
    {
      url: 'https://hooks.test/callback',
      method: 'POST',
      headers: { 'x-signature': 'normalized' },
      body: null
    }
  ])('rejects Fetch and legacy record-shaped substitutes', async substitute => {
    await expect(
      dispatchCapturedWebhookWireRequest({
        request: substitute,
        handle: async () => ({ status: 200 })
      })
    ).rejects.toBeTruthy();
  });
});
