import { describe, expect, it } from 'vitest';
import { contentAad, createContentCipher } from '../contentCipher';

let tenant = { id: 'gst_1', contentKeyVersion: 1 };
let aad = contentAad({ tenantId: 'gst_1', recordId: 'r1', index: 0, role: 'prompt' });

describe('createContentCipher', () => {
  it('round-trips text', () => {
    let cipher = createContentCipher('secret');
    let key = cipher.forTenant(tenant);

    let encrypted = cipher.encrypt(key, 'hello ünïcode', aad);

    expect(encrypted.iv).toHaveLength(12);
    expect(encrypted.ciphertext.toString('utf8')).not.toContain('hello');
    expect(cipher.decrypt(key, encrypted, aad)).toBe('hello ünïcode');
  });

  it('uses a fresh iv for every encryption', () => {
    let cipher = createContentCipher('secret');
    let key = cipher.forTenant(tenant);

    let first = cipher.encrypt(key, 'same', aad);
    let second = cipher.encrypt(key, 'same', aad);

    expect(first.iv.equals(second.iv)).toBe(false);
    expect(first.ciphertext.equals(second.ciphertext)).toBe(false);
  });

  it('fails when the text is moved to another position', () => {
    let cipher = createContentCipher('secret');
    let key = cipher.forTenant(tenant);
    let encrypted = cipher.encrypt(key, 'hello', aad);

    let moved = contentAad({ tenantId: 'gst_1', recordId: 'r1', index: 1, role: 'prompt' });

    expect(() => cipher.decrypt(key, encrypted, moved)).toThrow();
  });

  it('fails when the ciphertext is tampered with', () => {
    let cipher = createContentCipher('secret');
    let key = cipher.forTenant(tenant);
    let encrypted = cipher.encrypt(key, 'hello', aad);

    encrypted.ciphertext[0]! ^= 1;

    expect(() => cipher.decrypt(key, encrypted, aad)).toThrow();
  });

  it('derives distinct keys per tenant, version and secret', () => {
    let cipher = createContentCipher('secret');
    let base = cipher.forTenant(tenant).key;

    expect(cipher.forTenant(tenant).key.equals(base)).toBe(true);
    expect(cipher.forTenant({ id: 'gst_2', contentKeyVersion: 1 }).key.equals(base)).toBe(
      false
    );
    expect(cipher.forTenant({ id: 'gst_1', contentKeyVersion: 2 }).key.equals(base)).toBe(
      false
    );
    expect(createContentCipher('other').forTenant(tenant).key.equals(base)).toBe(false);
  });

  it('cannot decrypt with another tenant key', () => {
    let cipher = createContentCipher('secret');
    let encrypted = cipher.encrypt(cipher.forTenant(tenant), 'hello', aad);

    expect(() =>
      cipher.decrypt(cipher.forTenant({ id: 'gst_2', contentKeyVersion: 1 }), encrypted, aad)
    ).toThrow();
  });
});
