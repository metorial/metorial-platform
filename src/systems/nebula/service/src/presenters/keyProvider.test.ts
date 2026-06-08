import { Hash } from '@lowerdeck/hash';
import { describe, expect, it } from 'vitest';
import type { KeyProvider } from '../../prisma/generated/client';
import { keyProviderPresenter } from './keyProvider';

let baseKeyProvider = {
  oid: 1n,
  id: 'keyProvider_test',
  systemIdentifier: 'system:tenant:tenant_test:keyProvider_test',
  name: 'Test provider',
  type: 'aws_kms',
  owner: 'system',
  status: 'active',
  keyReuseTimeSeconds: null,
  tenantOid: 1n,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null
} satisfies Omit<KeyProvider, 'keyInfo' | 'isMetorialManaged'>;

describe('keyProviderPresenter', () => {
  it('redacts AWS key IDs and ARNs for Metorial-managed providers', async () => {
    let keyId = '1234abcd-12ab-34cd-56ef-1234567890ab';
    let keyProvider = {
      ...baseKeyProvider,
      isMetorialManaged: true,
      keyInfo: {
        variant: 'aws_kms',
        region: 'us-east-1',
        keyId,
        keyArn: `arn:aws:kms:us-east-1:123456789012:key/${keyId}`,
        accountId: '123456789012'
      }
    } as KeyProvider;

    let presented = await keyProviderPresenter(keyProvider);
    let hash = (await Hash.sha256(keyId)).slice(0, 20);
    let safeKeyId = `AWS KMS (via Metorial, ref: ${hash})`;

    expect(presented.keyInfo).toMatchObject({
      region: 'us-east-1',
      keyId: safeKeyId,
      keyArn: safeKeyId,
      accountId: null
    });
  });

  it('keeps AWS key IDs and ARNs for tenant-owned providers', async () => {
    let keyId = 'customer-key-id';
    let keyArn = `arn:aws:kms:us-east-1:123456789012:key/${keyId}`;
    let keyProvider = {
      ...baseKeyProvider,
      owner: 'tenant',
      isMetorialManaged: false,
      keyInfo: {
        variant: 'aws_kms',
        region: 'us-east-1',
        keyId,
        keyArn,
        accountId: '123456789012'
      }
    } as KeyProvider;

    let presented = await keyProviderPresenter(keyProvider);

    expect(presented.keyInfo).toMatchObject({
      keyId,
      keyArn,
      accountId: '123456789012'
    });
  });
});
