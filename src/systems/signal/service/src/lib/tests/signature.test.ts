import { describe, expect, it } from 'vitest';
import { generateSignature } from '../signature';

describe('generateSignature', () => {
  const secret = 'test_secret';
  const timestamp = 1704067200;
  const format = /^t=\d+,v1=[a-f0-9]{64}$/;

  it.concurrent.each([
    ['string payload', 'test payload'],
    ['object payload', { test: 'data', nested: { value: 123 } }],
    ['empty payload', ''],
    ['special chars payload', 'test\n\t\r special"chars\'!@#$%^&*()']
  ])('formats %s', async (_label, payload) => {
    const signature = await generateSignature(payload, secret, { timestamp });
    expect(signature).toMatch(format);
    expect(signature).toContain(`t=${timestamp}`);
  });

  it('is deterministic for the same input', async () => {
    const payload = { event: 'test' };
    const sig1 = await generateSignature(payload, secret, { timestamp });
    const sig2 = await generateSignature(payload, secret, { timestamp });
    expect(sig1).toBe(sig2);
  });

  it.concurrent.each([
    ['secret', { payload: 'test payload', secret: 'secret1', timestamp }, { payload: 'test payload', secret: 'secret2', timestamp }],
    ['timestamp', { payload: 'test payload', secret, timestamp: 1704067200 }, { payload: 'test payload', secret, timestamp: 1704067201 }],
    ['payload', { payload: 'payload1', secret, timestamp }, { payload: 'payload2', secret, timestamp }]
  ])('changes when %s changes', async (_label, a, b) => {
    const sig1 = await generateSignature(a.payload, a.secret, { timestamp: a.timestamp });
    const sig2 = await generateSignature(b.payload, b.secret, { timestamp: b.timestamp });
    expect(sig1).not.toBe(sig2);
  });

  it('uses current timestamp when not provided', async () => {
    const signature = await generateSignature('test payload', secret);
    const timestampMatch = signature.match(/^t=(\d+),/);
    expect(timestampMatch).toBeTruthy();
    if (!timestampMatch || !timestampMatch[1]) throw new Error('Invalid signature format');
    const now = Math.floor(Date.now() / 1000);
    const signatureTimestamp = parseInt(timestampMatch[1]);
    expect(Math.abs(signatureTimestamp - now)).toBeLessThanOrEqual(1);
  });
});
