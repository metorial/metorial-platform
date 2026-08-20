import { describe, expect, it } from 'vitest';
import { createHubVersionedEncryptionKeyring } from './encryption';

describe('createHubVersionedEncryptionKeyring', () => {
  it('creates a fresh keyring with the base key as version 1 by default', async () => {
    let config = { ENCRYPTION_KEY: 'hub-base-key' };
    let first = createHubVersionedEncryptionKeyring(config);
    let second = createHubVersionedEncryptionKeyring(config);

    expect(first).not.toBe(second);
    expect(first.activeKeyVersion).toBe(1);
    expect(() => first.assertAadVersion(1)).not.toThrow();
    expect(() => first.assertAadVersion(2)).toThrow(
      'Unsupported encrypted secret AAD version: 2'
    );

    let encrypted = await first.encrypt({
      secret: 'default-key-material',
      entityId: 'hub-encryption-default-key',
      aadVersion: 1
    });
    await expect(
      first.decrypt({
        encrypted,
        entityId: 'hub-encryption-default-key',
        encryptionKeyVersion: 1,
        aadVersion: 1
      })
    ).resolves.toBe('default-key-material');
  });

  it('adds JSON-configured key versions alongside the base key', async () => {
    let keyring = createHubVersionedEncryptionKeyring({
      ENCRYPTION_KEY: 'hub-v1-key',
      ENCRYPTION_KEYRING_JSON: JSON.stringify({ 2: 'hub-v2-key' })
    });
    let encryptedV1 = await keyring.encrypt({
      secret: 'v1-material',
      entityId: 'hub-encryption-v1',
      encryptionKeyVersion: 1,
      aadVersion: 1
    });
    let encryptedV2 = await keyring.encrypt({
      secret: 'v2-material',
      entityId: 'hub-encryption-v2',
      encryptionKeyVersion: 2,
      aadVersion: 1
    });

    await expect(
      keyring.decrypt({
        encrypted: encryptedV1,
        entityId: 'hub-encryption-v1',
        encryptionKeyVersion: 1,
        aadVersion: 1
      })
    ).resolves.toBe('v1-material');
    await expect(
      keyring.decrypt({
        encrypted: encryptedV2,
        entityId: 'hub-encryption-v2',
        encryptionKeyVersion: 2,
        aadVersion: 1
      })
    ).resolves.toBe('v2-material');
  });

  it('rejects malformed keyring JSON', () => {
    expect(() =>
      createHubVersionedEncryptionKeyring({
        ENCRYPTION_KEY: 'hub-v1-key',
        ENCRYPTION_KEYRING_JSON: '{'
      })
    ).toThrow(SyntaxError);
  });

  it('rejects non-string key material', () => {
    expect(() =>
      createHubVersionedEncryptionKeyring({
        ENCRYPTION_KEY: 'hub-v1-key',
        ENCRYPTION_KEYRING_JSON: JSON.stringify({ 2: 42 })
      })
    ).toThrow('Hub encryption keyring is invalid');
  });

  it('selects the configured active key for encryption', async () => {
    let keyring = createHubVersionedEncryptionKeyring({
      ENCRYPTION_KEY: 'hub-v1-key',
      ENCRYPTION_KEYRING_JSON: JSON.stringify({ 2: 'hub-v2-key' }),
      ENCRYPTION_ACTIVE_KEY_VERSION: 2
    });
    let encrypted = await keyring.encrypt({
      secret: 'active-key-material',
      entityId: 'hub-encryption-active-key',
      aadVersion: 1
    });

    expect(keyring.activeKeyVersion).toBe(2);
    await expect(
      keyring.decrypt({
        encrypted,
        entityId: 'hub-encryption-active-key',
        encryptionKeyVersion: 2,
        aadVersion: 1
      })
    ).resolves.toBe('active-key-material');
    await expect(
      keyring.decrypt({
        encrypted,
        entityId: 'hub-encryption-active-key',
        encryptionKeyVersion: 1,
        aadVersion: 1
      })
    ).rejects.toThrow();
  });

  it('parses the configured supported AAD versions with the shared parser', () => {
    let keyring = createHubVersionedEncryptionKeyring({
      ENCRYPTION_KEY: 'hub-v1-key',
      ENCRYPTION_ACTIVE_AAD_VERSION: 2,
      ENCRYPTION_SUPPORTED_AAD_VERSIONS: '1, 2'
    });

    expect(() => keyring.assertAadVersion(1)).not.toThrow();
    expect(() => keyring.assertAadVersion(2)).not.toThrow();
    expect(() => keyring.assertAadVersion(3)).toThrow(
      'Unsupported encrypted secret AAD version: 3'
    );
  });
});
