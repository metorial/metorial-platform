import { describe, expect, it } from 'vitest';
import {
  contentHash,
  createTenantKeyDeriver,
  hmac128,
  recordId,
  sessionKey,
  sha256Hex
} from '../keys';

let tenant = { id: 'tenant_a', hashKeyVersion: 1 };

describe('createTenantKeyDeriver', () => {
  it('derives the same key for the same secret and tenant', () => {
    let a = createTenantKeyDeriver('secret').forTenant(tenant);
    let b = createTenantKeyDeriver('secret').forTenant(tenant);

    expect(a.key.equals(b.key)).toBe(true);
    expect(a.tenantId).toBe('tenant_a');
    expect(a.version).toBe(1);
  });

  it('returns the cached instance on repeated lookups', () => {
    let deriver = createTenantKeyDeriver('secret');

    expect(deriver.forTenant(tenant)).toBe(deriver.forTenant({ ...tenant }));
  });

  it('isolates tenants', () => {
    let deriver = createTenantKeyDeriver('secret');

    let a = deriver.forTenant(tenant);
    let b = deriver.forTenant({ id: 'tenant_b', hashKeyVersion: 1 });

    expect(a.key.equals(b.key)).toBe(false);
  });

  it('isolates key versions', () => {
    let deriver = createTenantKeyDeriver('secret');

    let v1 = deriver.forTenant(tenant);
    let v2 = deriver.forTenant({ ...tenant, hashKeyVersion: 2 });

    expect(v1.key.equals(v2.key)).toBe(false);
    expect(v2.version).toBe(2);
  });

  it('depends on the root secret', () => {
    let a = createTenantKeyDeriver('one').forTenant(tenant);
    let b = createTenantKeyDeriver('two').forTenant(tenant);

    expect(a.key.equals(b.key)).toBe(false);
  });

  it('does not confuse tenant ids that share a prefix with the version', () => {
    let deriver = createTenantKeyDeriver('secret');

    let a = deriver.forTenant({ id: '1', hashKeyVersion: 12 });
    let b = deriver.forTenant({ id: '21', hashKeyVersion: 1 });

    expect(a.key.equals(b.key)).toBe(false);
  });

  it('keeps output stable across cache eviction', () => {
    let deriver = createTenantKeyDeriver('secret');
    let first = deriver.forTenant(tenant);
    let firstKey = Buffer.from(first.key);

    for (let i = 0; i < 2500; i++) deriver.forTenant({ id: `filler_${i}`, hashKeyVersion: 1 });

    let again = deriver.forTenant(tenant);

    expect(again).not.toBe(first);
    expect(again.key.equals(firstKey)).toBe(true);
  });
});

describe('hashing helpers', () => {
  let deriver = createTenantKeyDeriver('secret');
  let key = deriver.forTenant(tenant);
  let other = deriver.forTenant({ id: 'tenant_b', hashKeyVersion: 1 });

  it('produces 128-bit hex digests', () => {
    expect(hmac128(key, 'purpose', 'a')).toMatch(/^[0-9a-f]{32}$/);
  });

  it('is deterministic', () => {
    expect(recordId(key, 'ns', 'identity')).toBe(recordId(key, 'ns', 'identity'));
  });

  it('separates tenants for identical input', () => {
    expect(recordId(key, 'ns', 'identity')).not.toBe(recordId(other, 'ns', 'identity'));
    expect(contentHash(key, 'prompt', 'hello')).not.toBe(
      contentHash(other, 'prompt', 'hello')
    );
  });

  it('separates purposes for identical input', () => {
    let value = 'same';
    let digests = new Set([
      recordId(key, value, value),
      sessionKey(key, value, value),
      contentHash(key, value, value)
    ]);

    expect(digests.size).toBe(3);
  });

  it('separates parts so concatenations cannot collide', () => {
    expect(hmac128(key, 'p', 'ab', 'c')).not.toBe(hmac128(key, 'p', 'a', 'bc'));
    expect(recordId(key, 'a/b', 'c')).not.toBe(recordId(key, 'a', 'b/c'));
  });

  it('separates content roles', () => {
    expect(contentHash(key, 'prompt', 'x')).not.toBe(contentHash(key, 'response', 'x'));
  });

  it('hashes bytes and equivalent strings identically', () => {
    expect(contentHash(key, 'prompt', 'héllo')).toBe(
      contentHash(key, 'prompt', new TextEncoder().encode('héllo'))
    );
  });

  it('separates session families and ids', () => {
    expect(sessionKey(key, 'claude-code', 's1')).not.toBe(sessionKey(key, 'codex', 's1'));
    expect(sessionKey(key, 'codex', 's1')).not.toBe(sessionKey(key, 'codex', 's2'));
  });

  it('exposes plain sha256', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
    expect(sha256Hex(new TextEncoder().encode('abc'))).toBe(sha256Hex('abc'));
  });
});
