import { describe, expect, it } from 'vitest';
import { generateSignature } from '../signature';

describe('Signature verification', () => {
  const format = /^t=\d+,v1=[a-f0-9]{64}$/;
  const timestamp = 1704067200;
  const secret = 'secret';

  it('produces a parseable, deterministic signature', async () => {
    const payload = {
      eventType: 'user.created',
      data: { userId: '12345', email: 'test@example.com' }
    };

    const signature = await generateSignature(payload, secret, { timestamp });
    expect(signature).toMatch(format);

    const [timestampPart, signaturePart] = signature.split(',');
    expect(timestampPart).toBe(`t=${timestamp}`);
    expect(signaturePart).toMatch(/^v1=[a-f0-9]{64}$/);

    const signature2 = await generateSignature(payload, secret, { timestamp });
    expect(signature2).toBe(signature);
  });

  it.concurrent.each([
    ['simple object', { test: 'data' }],
    ['nested object', { user: { id: 1, profile: { name: 'Test' } } }],
    ['array payload', { items: [1, 2, 3] }]
  ])('formats %s payloads', async (_label, payload) => {
    const signature = await generateSignature(payload, secret, { timestamp });
    expect(signature).toMatch(format);
  });

  it('changes when payload changes', async () => {
    const sig1 = await generateSignature({ action: 'create' }, secret, { timestamp });
    const sig2 = await generateSignature({ action: 'delete' }, secret, { timestamp });
    expect(sig1).not.toBe(sig2);
  });

  it('changes when secret changes', async () => {
    const payload = { data: 'test' };
    const sig1 = await generateSignature(payload, 'secret1', { timestamp });
    const sig2 = await generateSignature(payload, 'secret2', { timestamp });
    expect(sig1).not.toBe(sig2);
  });

  it('changes when timestamp changes', async () => {
    const payload = { data: 'test' };
    const sig1 = await generateSignature(payload, secret, { timestamp: 1704067200 });
    const sig2 = await generateSignature(payload, secret, { timestamp: 1704067201 });
    expect(sig1).not.toBe(sig2);
  });
});
