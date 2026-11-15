import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  contentHash,
  createOrganizationKeyDeriver,
  hmac128,
  recordId,
  sessionKey,
  sha256Hex
} from '../src/keys';

let organization = { id: 'ator_a', hashKeyVersion: 1 };

describe('createOrganizationKeyDeriver', () => {
  it('derives the same key for the same secret and organization', () => {
    let a = createOrganizationKeyDeriver('secret').forOrganization(organization);
    let b = createOrganizationKeyDeriver('secret').forOrganization(organization);

    expect(a.key.equals(b.key)).toBe(true);
    expect(a.organizationId).toBe('ator_a');
    expect(a.version).toBe(1);
  });

  it('derives the key from the organization label', () => {
    let key = createOrganizationKeyDeriver('secret').forOrganization(organization);
    let expected = createHmac('sha256', 'secret')
      .update('agent-tracking/organization-key/v1/ator_a')
      .digest();

    expect(key.key.equals(expected)).toBe(true);
  });

  it('returns the cached instance on repeated lookups', () => {
    let deriver = createOrganizationKeyDeriver('secret');

    expect(deriver.forOrganization(organization)).toBe(
      deriver.forOrganization({ ...organization })
    );
  });

  it('isolates organizations', () => {
    let deriver = createOrganizationKeyDeriver('secret');

    let a = deriver.forOrganization(organization);
    let b = deriver.forOrganization({ id: 'ator_b', hashKeyVersion: 1 });

    expect(a.key.equals(b.key)).toBe(false);
  });

  it('isolates key versions', () => {
    let deriver = createOrganizationKeyDeriver('secret');

    let v1 = deriver.forOrganization(organization);
    let v2 = deriver.forOrganization({ ...organization, hashKeyVersion: 2 });

    expect(v1.key.equals(v2.key)).toBe(false);
    expect(v2.version).toBe(2);
  });

  it('depends on the root secret', () => {
    let a = createOrganizationKeyDeriver('one').forOrganization(organization);
    let b = createOrganizationKeyDeriver('two').forOrganization(organization);

    expect(a.key.equals(b.key)).toBe(false);
  });

  it('does not confuse organization ids that share a prefix with the version', () => {
    let deriver = createOrganizationKeyDeriver('secret');

    let a = deriver.forOrganization({ id: '1', hashKeyVersion: 12 });
    let b = deriver.forOrganization({ id: '21', hashKeyVersion: 1 });

    expect(a.key.equals(b.key)).toBe(false);
  });

  it('keeps output stable across cache eviction', () => {
    let deriver = createOrganizationKeyDeriver('secret');
    let first = deriver.forOrganization(organization);
    let firstKey = Buffer.from(first.key);

    for (let i = 0; i < 2500; i++) {
      deriver.forOrganization({ id: `filler_${i}`, hashKeyVersion: 1 });
    }

    let again = deriver.forOrganization(organization);

    expect(again).not.toBe(first);
    expect(again.key.equals(firstKey)).toBe(true);
  });
});

describe('hashing helpers', () => {
  let deriver = createOrganizationKeyDeriver('secret');
  let key = deriver.forOrganization(organization);
  let other = deriver.forOrganization({ id: 'ator_b', hashKeyVersion: 1 });

  it('produces 128-bit hex digests', () => {
    expect(hmac128(key, 'purpose', 'a')).toMatch(/^[0-9a-f]{32}$/);
  });

  it('is deterministic', () => {
    expect(recordId(key, 'atin_1', 'ns', 'identity')).toBe(
      recordId(key, 'atin_1', 'ns', 'identity')
    );
  });

  it('separates organizations for identical input', () => {
    expect(recordId(key, 'atin_1', 'ns', 'identity')).not.toBe(
      recordId(other, 'atin_1', 'ns', 'identity')
    );
    expect(contentHash(key, 'prompt', 'hello')).not.toBe(
      contentHash(other, 'prompt', 'hello')
    );
  });

  it('separates instances of one organization for identical input', () => {
    expect(recordId(key, 'atin_1', 'ns', 'identity')).not.toBe(
      recordId(key, 'atin_2', 'ns', 'identity')
    );
    expect(sessionKey(key, 'atin_1', 'codex', 's1')).not.toBe(
      sessionKey(key, 'atin_2', 'codex', 's1')
    );
  });

  it('keeps content hashes equal across instances of one organization', () => {
    expect(contentHash(key, 'prompt', 'hello')).toBe(
      contentHash(deriver.forOrganization({ ...organization }), 'prompt', 'hello')
    );
  });

  it('separates purposes for identical input', () => {
    let value = 'same';
    let digests = new Set([
      recordId(key, value, value, value),
      sessionKey(key, value, value, value),
      contentHash(key, value, value)
    ]);

    expect(digests.size).toBe(3);
  });

  it('separates parts so concatenations cannot collide', () => {
    expect(hmac128(key, 'p', 'ab', 'c')).not.toBe(hmac128(key, 'p', 'a', 'bc'));
    expect(recordId(key, 'atin_1', 'a/b', 'c')).not.toBe(recordId(key, 'atin_1', 'a', 'b/c'));
    expect(recordId(key, 'atin_1a', 'b', 'c')).not.toBe(recordId(key, 'atin_1', 'ab', 'c'));
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
    expect(sessionKey(key, 'atin_1', 'claude-code', 's1')).not.toBe(
      sessionKey(key, 'atin_1', 'codex', 's1')
    );
    expect(sessionKey(key, 'atin_1', 'codex', 's1')).not.toBe(
      sessionKey(key, 'atin_1', 'codex', 's2')
    );
  });

  it('exposes plain sha256', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
    expect(sha256Hex(new TextEncoder().encode('abc'))).toBe(sha256Hex('abc'));
  });
});
