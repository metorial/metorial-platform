import { beforeAll, describe, expect, it } from 'vitest';
import { SecureEncryption } from '../src/store/default/crypto';

describe('SecureEncryption', () => {
  const password = 'super-secret-password';
  const plainText = 'Hello, Secure World!';
  let secureEncryption: SecureEncryption;

  beforeAll(() => {
    secureEncryption = new SecureEncryption(password);
  });

  it('should encrypt and decrypt text correctly', async () => {
    const encrypted = await secureEncryption.encrypt(plainText);
    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toBe(plainText);

    const decrypted = await secureEncryption.decrypt(encrypted);
    expect(decrypted).toBe(plainText);
  });

  it('should produce different ciphertexts for the same plaintext (random salt/iv)', async () => {
    const encrypted1 = await secureEncryption.encrypt(plainText);
    const encrypted2 = await secureEncryption.encrypt(plainText);
    expect(encrypted1).not.toBe(encrypted2);

    const decrypted1 = await secureEncryption.decrypt(encrypted1);
    const decrypted2 = await secureEncryption.decrypt(encrypted2);
    expect(decrypted1).toBe(plainText);
    expect(decrypted2).toBe(plainText);
  });

  it('should fail to decrypt with a different password', async () => {
    const encrypted = await secureEncryption.encrypt(plainText);
    const wrongEncryption = new SecureEncryption('wrong-password');
    await expect(wrongEncryption.decrypt(encrypted)).rejects.toThrow();
  });

  it('should throw when decrypting invalid data', async () => {
    await expect(secureEncryption.decrypt('invalid-data')).rejects.toThrow();
  });
});
