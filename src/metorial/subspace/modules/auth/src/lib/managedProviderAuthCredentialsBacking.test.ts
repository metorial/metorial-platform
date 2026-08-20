import { Encryption, VersionedEncryptionKeyring } from '@lowerdeck/encryption';
import { describe, expect, it } from 'vitest';
import { managedCredentialBackingContext } from './managedProviderAuthCredentialsSecretContext';

describe('managed OAuth tenant projection envelope', () => {
  it('rejects swapped tenant, backing, credential, source, purpose, and versions', async () => {
    let provider = new Encryption('managed-test-key');
    let base = {
      tenantId: 'tenant-1',
      managedCredentialsId: 'managed-1',
      backingOid: 1n,
      providerAuthCredentialsId: 'credential-1',
      sourceSecretId: 'source-1',
      sourceSecretVersion: 2,
      purpose: 'oauth_client_secret',
      secretVersion: 3,
      encryptionKeyVersion: 1,
      aadVersion: 1
    };
    let encrypted = await provider.encrypt({
      entityId: managedCredentialBackingContext(base),
      secret: 'secret'
    });
    await expect(
      provider.decrypt({ entityId: managedCredentialBackingContext(base), encrypted })
    ).resolves.toBe('secret');
    for (let changed of [
      { ...base, tenantId: 'tenant-2' },
      { ...base, managedCredentialsId: 'managed-2' },
      { ...base, backingOid: 2n },
      { ...base, providerAuthCredentialsId: 'credential-2' },
      { ...base, sourceSecretId: 'source-2' },
      { ...base, sourceSecretVersion: 4 },
      { ...base, purpose: 'other' },
      { ...base, secretVersion: 4 },
      { ...base, encryptionKeyVersion: 2 },
      { ...base, aadVersion: 2 }
    ])
      await expect(
        provider.decrypt({ entityId: managedCredentialBackingContext(changed), encrypted })
      ).rejects.toThrow();
  });

  it('reads historical v1 with active v2 and preserves source/grace state on re-encrypt', async () => {
    let keyring = new VersionedEncryptionKeyring({
      keys: { 1: 'old-subspace-key', 2: 'new-subspace-key' },
      activeKeyVersion: 2,
      supportedAadVersions: [1, 2]
    });
    let v1 = {
      tenantId: 'tenant-1',
      managedCredentialsId: 'managed-1',
      backingOid: 1n,
      providerAuthCredentialsId: 'credential-1',
      sourceSecretId: 'source-1',
      sourceSecretVersion: 3,
      purpose: 'oauth_client_secret',
      secretVersion: 4,
      encryptionKeyVersion: 1,
      aadVersion: 1
    };
    let encrypted = await keyring.encrypt({
      secret: 'subspace-material',
      entityId: managedCredentialBackingContext(v1),
      encryptionKeyVersion: 1,
      aadVersion: 1
    });
    let plaintext = await keyring.decrypt({
      encrypted,
      entityId: managedCredentialBackingContext(v1),
      encryptionKeyVersion: 1,
      aadVersion: 1
    });
    let v2 = { ...v1, encryptionKeyVersion: 2, aadVersion: 2 };
    let reencrypted = await keyring.encrypt({
      secret: plaintext,
      entityId: managedCredentialBackingContext(v2),
      encryptionKeyVersion: 2,
      aadVersion: 2
    });
    await expect(
      keyring.decrypt({
        encrypted: reencrypted,
        entityId: managedCredentialBackingContext(v2),
        encryptionKeyVersion: 2,
        aadVersion: 2
      })
    ).resolves.toBe('subspace-material');
    expect(v2).toMatchObject({
      sourceSecretId: 'source-1',
      sourceSecretVersion: 3,
      secretVersion: 4
    });
    expect(() => managedCredentialBackingContext({ ...v2, aadVersion: 3 })).toThrow(
      'Unsupported managed-secret AAD grammar'
    );
  });
});
