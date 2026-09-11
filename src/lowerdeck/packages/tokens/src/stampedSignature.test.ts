import { describe, expect, test } from 'vitest';
import { StampedSignature } from './stampedSignature';

describe('StampedSignature', () => {
  let stamp = new StampedSignature({ secret: 'test-secret' });

  test('should sign and verify a value', async () => {
    let { ts, sig } = await stamp.sign('attachment-id');
    expect(await stamp.verify('attachment-id', ts, sig, 60_000)).toBe(true);
  });

  test('should reject a tampered value', async () => {
    let { ts, sig } = await stamp.sign('attachment-id');
    expect(await stamp.verify('other-id', ts, sig, 60_000)).toBe(false);
  });

  test('should reject a tampered signature', async () => {
    let { ts } = await stamp.sign('attachment-id');
    expect(await stamp.verify('attachment-id', ts, 'not-a-real-signature', 60_000)).toBe(false);
  });

  test('should reject an expired signature', async () => {
    let { ts, sig } = await stamp.sign('attachment-id', Date.now() - 120_000);
    expect(await stamp.verify('attachment-id', ts, sig, 60_000)).toBe(false);
  });

  test('should reject a signature from a different secret', async () => {
    let other = new StampedSignature({ secret: 'different-secret' });
    let { ts, sig } = await stamp.sign('attachment-id');
    expect(await other.verify('attachment-id', ts, sig, 60_000)).toBe(false);
  });

  test('should reject an implausible future timestamp', async () => {
    let { ts, sig } = await stamp.sign('attachment-id', Date.now() + 60_000);
    expect(await stamp.verify('attachment-id', ts, sig, 600_000)).toBe(false);
  });
});
