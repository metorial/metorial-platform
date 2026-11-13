import { describe, expect, it } from 'vitest';
import { contentAad, createContentCipher } from '../contentCipher';

let organization = { id: 'gor_1', contentKeyVersion: 1 };
let aad = contentAad({ organizationId: 'gor_1', recordId: 'r1', index: 0, role: 'prompt' });

describe('createContentCipher', () => {
  it('round-trips text', () => {
    let cipher = createContentCipher('secret');
    let key = cipher.forOrganization(organization);

    let encrypted = cipher.encrypt(key, 'hello ünïcode', aad);

    expect(encrypted.iv).toHaveLength(12);
    expect(encrypted.ciphertext.toString('utf8')).not.toContain('hello');
    expect(cipher.decrypt(key, encrypted, aad)).toBe('hello ünïcode');
  });

  it('uses a fresh iv for every encryption', () => {
    let cipher = createContentCipher('secret');
    let key = cipher.forOrganization(organization);

    let first = cipher.encrypt(key, 'same', aad);
    let second = cipher.encrypt(key, 'same', aad);

    expect(first.iv.equals(second.iv)).toBe(false);
    expect(first.ciphertext.equals(second.ciphertext)).toBe(false);
  });

  it('fails when the text is moved to another position', () => {
    let cipher = createContentCipher('secret');
    let key = cipher.forOrganization(organization);
    let encrypted = cipher.encrypt(key, 'hello', aad);

    let moved = contentAad({
      organizationId: 'gor_1',
      recordId: 'r1',
      index: 1,
      role: 'prompt'
    });

    expect(() => cipher.decrypt(key, encrypted, moved)).toThrow();
  });

  it('fails when the ciphertext is tampered with', () => {
    let cipher = createContentCipher('secret');
    let key = cipher.forOrganization(organization);
    let encrypted = cipher.encrypt(key, 'hello', aad);

    encrypted.ciphertext[0]! ^= 1;

    expect(() => cipher.decrypt(key, encrypted, aad)).toThrow();
  });

  it('derives distinct keys per organization, version and secret', () => {
    let cipher = createContentCipher('secret');
    let base = cipher.forOrganization(organization).key;

    expect(cipher.forOrganization(organization).key.equals(base)).toBe(true);
    expect(
      cipher.forOrganization({ id: 'gor_2', contentKeyVersion: 1 }).key.equals(base)
    ).toBe(false);
    expect(
      cipher.forOrganization({ id: 'gor_1', contentKeyVersion: 2 }).key.equals(base)
    ).toBe(false);
    expect(createContentCipher('other').forOrganization(organization).key.equals(base)).toBe(
      false
    );
  });

  it('cannot decrypt with another organization key', () => {
    let cipher = createContentCipher('secret');
    let encrypted = cipher.encrypt(cipher.forOrganization(organization), 'hello', aad);

    expect(() =>
      cipher.decrypt(
        cipher.forOrganization({ id: 'gor_2', contentKeyVersion: 1 }),
        encrypted,
        aad
      )
    ).toThrow();
  });
});
