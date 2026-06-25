import { describe, expect, test } from 'vitest';
import { createRpcSignatureHeader, verifyRpcSignature } from './signature';

let baseInput = {
  token: 'rpc-token-secret',
  timestamp: 1_800_000_000_000,
  method: 'POST',
  url: 'https://eu1.metorial.test/sync?batch=1',
  body: '{"calls":[]}'
};

let verifyBase = (overrides: Partial<Parameters<typeof verifyRpcSignature>[0]> = {}) =>
  verifyRpcSignature({
    token: baseInput.token,
    method: baseInput.method,
    url: baseInput.url,
    body: baseInput.body,
    signatureHeader: createRpcSignatureHeader(baseInput),
    now: baseInput.timestamp,
    ...overrides
  });

describe('rpc signatures', () => {
  test('creates headers with embedded timestamp and signature', () => {
    expect(createRpcSignatureHeader(baseInput)).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
  });

  test('verifies a valid signature', () => {
    expect(verifyBase()).toBe(true);
  });

  test('rejects modified signed fields', () => {
    expect(verifyBase({ body: '{"calls":[{"id":"changed"}]}' })).toBe(false);
    expect(verifyBase({ url: 'https://eu1.metorial.test/sync?batch=2' })).toBe(false);
    expect(verifyBase({ method: 'PUT' })).toBe(false);
    expect(verifyBase({ token: 'different-token-secret' })).toBe(false);
  });

  test('rejects stale signatures', () => {
    expect(verifyBase({ now: baseInput.timestamp + 60_001 })).toBe(false);
  });

  test('rejects missing and malformed signature fields', () => {
    expect(verifyBase({ signatureHeader: null })).toBe(false);
    expect(verifyBase({ signatureHeader: 'v1=abc' })).toBe(false);
    expect(verifyBase({ signatureHeader: 't=1800000000000' })).toBe(false);
    expect(verifyBase({ signatureHeader: 't=1800000000000,v1=not-hex' })).toBe(false);
    expect(verifyBase({ signatureHeader: 't=not-a-number,v1=' + 'a'.repeat(64) })).toBe(false);
  });

  test('rejects unequal-length signatures without throwing', () => {
    expect(() =>
      verifyBase({ signatureHeader: `t=${baseInput.timestamp},v1=${'a'.repeat(62)}` })
    ).not.toThrow();

    expect(
      verifyBase({ signatureHeader: `t=${baseInput.timestamp},v1=${'a'.repeat(62)}` })
    ).toBe(false);
  });

  test('rejects equal-length mismatched signatures without throwing', () => {
    let signatureHeader = `t=${baseInput.timestamp},v1=${'a'.repeat(64)}`;

    expect(() => verifyBase({ signatureHeader })).not.toThrow();
    expect(verifyBase({ signatureHeader })).toBe(false);
  });
});
