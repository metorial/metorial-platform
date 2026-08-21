import { describe, expect, it } from 'vitest';
import {
  generateSignature,
  parseMetorialSignature,
  verifyMetorialSignature,
  verifyMetorialSignatureDetailed
} from './webhookSignature';

describe('public Metorial webhook signature helper', () => {
  let timestamp = 1_704_067_200;

  it('emits exactly one v1 signature and verifies exact raw bytes', async () => {
    let body = new Uint8Array([0, 255, 1, 10]);
    let header = await generateSignature(body, 'secret', { timestamp });

    expect(header).toMatch(/^t=1704067200,v1=[a-f0-9]{64}$/);
    expect(parseMetorialSignature(header).timestamp).toBe(timestamp);
    await expect(
      verifyMetorialSignature({
        header,
        body,
        signingSecret: 'secret',
        options: { nowSeconds: timestamp }
      })
    ).resolves.toBe(true);
    await expect(
      verifyMetorialSignature({
        header,
        body: new Uint8Array([0, 255, 1, 11]),
        signingSecret: 'secret',
        options: { nowSeconds: timestamp }
      })
    ).resolves.toBe(false);
  });

  it('rejects stale, future, multiple, and unauthenticated signatures', async () => {
    let header = await generateSignature('payload', 'secret', { timestamp });

    await expect(
      verifyMetorialSignatureDetailed({
        header,
        body: 'payload',
        signingSecret: 'secret',
        options: { nowSeconds: timestamp + 301 }
      })
    ).resolves.toEqual({ valid: false, reason: 'stale', timestamp });
    await expect(
      verifyMetorialSignatureDetailed({
        header,
        body: 'payload',
        signingSecret: 'secret',
        options: { nowSeconds: timestamp - 61 }
      })
    ).resolves.toEqual({ valid: false, reason: 'future', timestamp });
    await expect(
      verifyMetorialSignatureDetailed({
        header: `${header},v1=${'a'.repeat(64)}`,
        body: 'payload',
        signingSecret: 'secret',
        options: { nowSeconds: timestamp }
      })
    ).resolves.toEqual({ valid: false, reason: 'malformed' });
    await expect(
      verifyMetorialSignatureDetailed({
        header,
        body: 'payload',
        signingSecret: 'wrong',
        options: { nowSeconds: timestamp }
      })
    ).resolves.toEqual({ valid: false, reason: 'signature_mismatch', timestamp });
  });
});
