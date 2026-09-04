import { describe, expect, it } from 'vitest';
import { secretsCrypto } from './crypto';
import { Encryption } from './index';

let encryption = new Encryption('test-password');

describe('Encryption', () => {
  it('round trips a secret through the raw-bytes form', async () => {
    let encrypted = await encryption.encryptToBytes({
      secret: 'super-secret',
      entityId: 'otkp_1'
    });

    expect(encrypted).toBeInstanceOf(Uint8Array);

    let decrypted = await encryption.decryptFromBytes({ encrypted, entityId: 'otkp_1' });
    expect(decrypted).toBe('super-secret');
  });

  it('fails to decrypt bytes encrypted for a different entity', async () => {
    let encrypted = await encryption.encryptToBytes({
      secret: 'super-secret',
      entityId: 'otkp_1'
    });

    await expect(
      encryption.decryptFromBytes({ encrypted, entityId: 'otkp_2' })
    ).rejects.toThrow();
  });

  it('produces different ciphertexts for the same secret', async () => {
    let a = await encryption.encryptToBytes({ secret: 'same', entityId: 'otkp_1' });
    let b = await encryption.encryptToBytes({ secret: 'same', entityId: 'otkp_1' });

    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('still round trips the base86 string form', async () => {
    let encrypted = await encryption.encrypt({ secret: 'super-secret', entityId: 'otkp_1' });

    expect(typeof encrypted).toBe('string');
    expect(await encryption.decrypt({ encrypted, entityId: 'otkp_1' })).toBe('super-secret');
  });
});

describe('secretsCrypto', () => {
  /**
   * The string form is only a base86 wrapper around the bytes form, so a payload encrypted one
   * way has to decrypt the other after re-encoding.
   */
  it('treats the bytes and string forms as the same ciphertext', async () => {
    let { base86 } = await import('./base86');

    let bytes = await secretsCrypto.encryptToBytes('plaintext', 'password');
    expect(await secretsCrypto.decrypt(base86.encode(bytes), 'password')).toBe('plaintext');

    let string = await secretsCrypto.encrypt('plaintext', 'password');
    expect(await secretsCrypto.decryptFromBytes(base86.decode(string), 'password')).toBe(
      'plaintext'
    );
  });
});
