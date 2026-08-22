import { describe, expect, it } from 'vitest';
import {
  assertUnambiguousSecurityHeaders,
  captureWebhookWireRequest,
  WebhookCaptureError
} from './webhookRequestCapture';

describe('captureWebhookWireRequest', () => {
  it('captures a standard Fetch request without deployment attestation', async () => {
    let request = new Request('https://example.com/webhook?topic=created', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-event-id': 'evt_1' },
      body: '{"ok":true}'
    });

    await expect(captureWebhookWireRequest({ request })).resolves.toMatchObject({
      url: 'https://example.com/webhook?topic=created',
      method: 'POST',
      headers: expect.arrayContaining([
        ['content-type', 'application/json'],
        ['x-event-id', 'evt_1']
      ]),
      body: {
        present: true,
        base64: Buffer.from('{"ok":true}').toString('base64')
      }
    });
  });

  it('rejects duplicate security headers before verification', () => {
    expect(() =>
      assertUnambiguousSecurityHeaders([
        ['Stripe-Signature', 'first'],
        ['stripe-signature', 'second']
      ])
    ).toThrowError(WebhookCaptureError);
  });
});
