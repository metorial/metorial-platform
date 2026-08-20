import { describe, expect, it } from 'vitest';
import { parseSupportedEncryptionAadVersions, VersionedEncryptionKeyring } from './index';

describe('VersionedEncryptionKeyring', () => {
  it('decrypts historical versions and rejects wrong key or AAD versions', async () => {
    let keyring = new VersionedEncryptionKeyring({
      keys: { 1: 'old-key', 2: 'new-key' },
      activeKeyVersion: 2,
      supportedAadVersions: [1, 2]
    });
    let encrypted = await keyring.encrypt({
      secret: 'material',
      entityId: 'closed-context-v1',
      encryptionKeyVersion: 1,
      aadVersion: 1
    });
    await expect(
      keyring.decrypt({
        encrypted,
        entityId: 'closed-context-v1',
        encryptionKeyVersion: 1,
        aadVersion: 1
      })
    ).resolves.toBe('material');
    await expect(
      keyring.decrypt({
        encrypted,
        entityId: 'closed-context-v1',
        encryptionKeyVersion: 2,
        aadVersion: 1
      })
    ).rejects.toThrow();
    await expect(
      keyring.decrypt({
        encrypted,
        entityId: 'closed-context-v1',
        encryptionKeyVersion: 1,
        aadVersion: 3
      })
    ).rejects.toThrow('Unsupported encrypted secret AAD version');
  });

  it('keeps historical v1 configured when v2 becomes active', () => {
    expect(parseSupportedEncryptionAadVersions({ activeAadVersion: 1 })).toEqual([1]);
    expect(parseSupportedEncryptionAadVersions({ activeAadVersion: 2 })).toEqual([1, 2]);
    expect(
      parseSupportedEncryptionAadVersions({
        configured: '[1,2]',
        activeAadVersion: 2
      })
    ).toEqual([1, 2]);
    expect(() =>
      parseSupportedEncryptionAadVersions({ configured: '[1]', activeAadVersion: 2 })
    ).toThrow('Active encrypted secret AAD version is not supported');
  });
});
