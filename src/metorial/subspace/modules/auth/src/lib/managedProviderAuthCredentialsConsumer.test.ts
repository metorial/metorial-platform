import { VersionedEncryptionKeyring } from '@lowerdeck/encryption';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let { findBacking } = vi.hoisted(() => ({ findBacking: vi.fn() }));
vi.mock('@metorial-subspace/db', () => ({
  db: {
    managedProviderAuthCredentialsBacking: { findUnique: findBacking },
    managedProviderAuthCredentialSecret: {
      findMany: () => {
        throw new Error('workload resolver accessed platform source');
      }
    }
  }
}));
vi.mock('../env', () => ({
  env: {
    encryption: {
      ENCRYPTION_KEY: 'subspace-consumer-key',
      ENCRYPTION_ACTIVE_KEY_VERSION: 1,
      ENCRYPTION_ACTIVE_AAD_VERSION: 1,
      ENCRYPTION_SUPPORTED_AAD_VERSIONS: '1'
    }
  }
}));

import {
  managedCredentialSecretMigrationMetrics,
  resolveManagedCredentialBackingSecret
} from './managedProviderAuthCredentialsSecret';
import { managedCredentialBackingContext } from './managedProviderAuthCredentialsSecretContext';

let tenant = { oid: 10n, id: 'tenant-1' };
let base = {
  tenantId: tenant.id,
  managedCredentialsId: 'managed-1',
  backingOid: 20n,
  providerAuthCredentialsId: 'credential-1',
  sourceSecretId: 'source-1',
  sourceSecretVersion: 2,
  purpose: 'oauth_client_secret',
  secretVersion: 3,
  encryptionKeyVersion: 1,
  aadVersion: 1
};

beforeEach(() => {
  findBacking.mockReset();
  managedCredentialSecretMigrationMetrics.legacyFallbacks = 0;
});

describe('managed credential workload backing consumer', () => {
  it('decrypts only the authoritative tenant backing and never accesses platform source', async () => {
    let keyring = new VersionedEncryptionKeyring({
      keys: { 1: 'subspace-consumer-key' },
      activeKeyVersion: 1,
      supportedAadVersions: [1]
    });
    let encryptedValue = await keyring.encrypt({
      entityId: managedCredentialBackingContext(base),
      secret: 'tenant-backing-secret',
      encryptionKeyVersion: 1,
      aadVersion: 1
    });
    findBacking.mockResolvedValue({
      oid: base.backingOid,
      tenantOid: tenant.oid,
      managedCredentialsOid: 30n,
      providerAuthCredentialsOid: 40n,
      tenant,
      managedCredentials: { id: base.managedCredentialsId },
      providerAuthCredentials: { id: base.providerAuthCredentialsId },
      secrets: [
        {
          ...base,
          oid: 50n,
          id: 'backing-secret-1',
          managedCredentialsBackingOid: base.backingOid,
          tenantOid: tenant.oid,
          managedCredentialsOid: 30n,
          providerAuthCredentialsOid: 40n,
          encryptedValue,
          status: 'active',
          validFrom: new Date('2026-01-01T00:00:00.000Z'),
          validUntil: null
        }
      ]
    });

    await expect(
      resolveManagedCredentialBackingSecret({
        tenant: tenant as never,
        managedCredentialsOid: 30n
      })
    ).resolves.toMatchObject({
      state: 'encrypted',
      plaintext: 'tenant-backing-secret',
      legacyFallback: false,
      sourceSecretId: 'source-1',
      sourceSecretVersion: 2
    });
    expect(managedCredentialSecretMigrationMetrics.legacyFallbacks).toBe(0);
  });

  it('meters compatibility only when no encrypted row exists', async () => {
    findBacking.mockResolvedValue({ secrets: [] });
    await expect(
      resolveManagedCredentialBackingSecret({
        tenant: tenant as never,
        managedCredentialsOid: 30n
      })
    ).resolves.toMatchObject({ state: 'not_migrated', legacyFallback: true });
    expect(managedCredentialSecretMigrationMetrics.legacyFallbacks).toBe(1);
  });

  it('fails closed for revoked or corrupt encrypted state without incrementing fallback', async () => {
    findBacking.mockResolvedValue({
      secrets: [
        {
          status: 'revoked',
          validFrom: new Date('2026-01-01T00:00:00.000Z'),
          managedCredentialsOid: 30n
        }
      ]
    });
    await expect(
      resolveManagedCredentialBackingSecret({
        tenant: tenant as never,
        managedCredentialsOid: 30n
      })
    ).rejects.toThrow('not readable');
    expect(managedCredentialSecretMigrationMetrics.legacyFallbacks).toBe(0);
  });
});
