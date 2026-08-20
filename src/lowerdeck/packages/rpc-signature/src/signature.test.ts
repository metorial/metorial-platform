import { describe, expect, test } from 'vitest';
import {
  createRpcSignatureHeader,
  deriveBoundRpcSignatureToken,
  verifyRpcSignature
} from './signature';

let baseInput = {
  token: 'rpc-token-secret',
  timestamp: 1_800_000_000_000,
  method: 'POST',
  url: 'https://eu1.metorial.test/sync?batch=1',
  body: '{"calls":[]}'
};

let verifyBase = async (overrides: Partial<Parameters<typeof verifyRpcSignature>[0]> = {}) =>
  verifyRpcSignature({
    token: baseInput.token,
    method: baseInput.method,
    url: baseInput.url,
    body: baseInput.body,
    signatureHeader: await createRpcSignatureHeader(baseInput),
    now: baseInput.timestamp,
    ...overrides
  });

describe('rpc signatures', () => {
  test('derives a deterministic context-bound child token', async () => {
    let first = await deriveBoundRpcSignatureToken('root-secret', 'context-a');
    expect(first).toBe(await deriveBoundRpcSignatureToken('root-secret', 'context-a'));
    expect(first).not.toBe(await deriveBoundRpcSignatureToken('root-secret', 'context-b'));
    expect(first).not.toBe(await deriveBoundRpcSignatureToken('other-root', 'context-a'));
  });
  test('creates headers with embedded timestamp and signature', async () => {
    expect(await createRpcSignatureHeader(baseInput)).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
  });

  test('verifies a valid signature', async () => {
    expect(await verifyBase()).toBe(true);
  });

  test('rejects modified signed fields', async () => {
    expect(await verifyBase({ body: '{"calls":[{"id":"changed"}]}' })).toBe(false);
    expect(await verifyBase({ url: 'https://eu1.metorial.test/sync?batch=2' })).toBe(false);
    expect(await verifyBase({ method: 'PUT' })).toBe(false);
    expect(await verifyBase({ token: 'different-token-secret' })).toBe(false);
  });

  test('rejects stale signatures', async () => {
    expect(await verifyBase({ now: baseInput.timestamp + 60_001 })).toBe(false);
  });

  test('rejects missing and malformed signature fields', async () => {
    expect(await verifyBase({ signatureHeader: null })).toBe(false);
    expect(await verifyBase({ signatureHeader: 'v1=abc' })).toBe(false);
    expect(await verifyBase({ signatureHeader: 't=1800000000000' })).toBe(false);
    expect(await verifyBase({ signatureHeader: 't=1800000000000,v1=not-hex' })).toBe(false);
    expect(await verifyBase({ signatureHeader: 't=not-a-number,v1=' + 'a'.repeat(64) })).toBe(
      false
    );
  });

  test('rejects unequal-length signatures without throwing', async () => {
    await expect(
      verifyBase({ signatureHeader: `t=${baseInput.timestamp},v1=${'a'.repeat(62)}` })
    ).resolves.toBe(false);
  });

  test('rejects equal-length mismatched signatures without throwing', async () => {
    let signatureHeader = `t=${baseInput.timestamp},v1=${'a'.repeat(64)}`;

    await expect(verifyBase({ signatureHeader })).resolves.toBe(false);
  });
});
