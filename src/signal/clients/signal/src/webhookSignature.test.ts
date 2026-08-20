import { describe, expect, it } from 'vitest';
import {
  generateSignatures,
  verifyMetorialSignature,
  verifyMetorialSignatureDetailed
} from './webhookSignature';

describe('public Metorial callback signature verifier', () => {
  let timestamp = 1_704_067_200;

  it('verifies exact raw bytes and accepts active or retiring secrets', async () => {
    let body = new Uint8Array([0, 255, 1, 10]);
    let header = await generateSignatures(body, ['active', 'retiring'], { timestamp });

    await expect(
      verifyMetorialSignature({
        header,
        body,
        signingSecrets: ['retiring'],
        options: { nowSeconds: timestamp }
      })
    ).resolves.toBe(true);
    await expect(
      verifyMetorialSignature({
        header,
        body: new Uint8Array([0, 255, 1, 11]),
        signingSecrets: ['retiring'],
        options: { nowSeconds: timestamp }
      })
    ).resolves.toBe(false);
  });

  it('rejects stale, future, malformed, and unauthenticated signatures', async () => {
    let header = await generateSignatures('payload', ['secret'], { timestamp });

    await expect(
      verifyMetorialSignatureDetailed({
        header,
        body: 'payload',
        signingSecrets: ['secret'],
        options: { nowSeconds: timestamp + 301 }
      })
    ).resolves.toEqual({ valid: false, reason: 'stale', timestamp });
    await expect(
      verifyMetorialSignatureDetailed({
        header,
        body: 'payload',
        signingSecrets: ['secret'],
        options: { nowSeconds: timestamp - 61 }
      })
    ).resolves.toEqual({ valid: false, reason: 'future', timestamp });
    await expect(
      verifyMetorialSignatureDetailed({
        header: 'not-a-signature',
        body: 'payload',
        signingSecrets: ['secret'],
        options: { nowSeconds: timestamp }
      })
    ).resolves.toEqual({ valid: false, reason: 'malformed' });

    await expect(
      verifyMetorialSignatureDetailed({
        header,
        body: 'tampered',
        signingSecrets: ['secret'],
        options: { nowSeconds: timestamp + 301 }
      })
    ).resolves.toEqual({ valid: false, reason: 'signature_mismatch', timestamp });
  });
});
