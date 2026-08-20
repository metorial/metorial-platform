import { Encryption, VersionedEncryptionKeyring } from '@lowerdeck/encryption';
import { describe, expect, it, vi } from 'vitest';
import {
  signalSigningSecretContext,
  webhookDestinationSigningSecretService
} from './webhookDestinationSigningSecret';

describe('Signal signing secret envelope', () => {
  it('rejects every swapped owner/purpose/version component', async () => {
    let provider = new Encryption('signal-test-key');
    let base = {
      tenantId: 'tenant-1',
      webhookId: 'webhook-1',
      purpose: 'webhook_signing',
      secretVersion: 7,
      encryptionKeyVersion: 2,
      aadVersion: 1
    };
    let encrypted = await provider.encrypt({
      entityId: signalSigningSecretContext(base),
      secret: 'secret'
    });
    await expect(
      provider.decrypt({ entityId: signalSigningSecretContext(base), encrypted })
    ).resolves.toBe('secret');
    for (let changed of [
      { ...base, tenantId: 'tenant-2' },
      { ...base, webhookId: 'webhook-2' },
      { ...base, purpose: 'other' },
      { ...base, secretVersion: 8 },
      { ...base, encryptionKeyVersion: 3 },
      { ...base, aadVersion: 2 }
    ]) {
      await expect(
        provider.decrypt({ entityId: signalSigningSecretContext(changed), encrypted })
      ).rejects.toThrow();
    }
  });

  it('keeps v1 readable with active v2 and preserves rotation/receipt state on re-encrypt', async () => {
    let keyring = new VersionedEncryptionKeyring({
      keys: { 1: 'old-signal-key', 2: 'new-signal-key' },
      activeKeyVersion: 2,
      supportedAadVersions: [1, 2]
    });
    let v1 = {
      tenantId: 'tenant-1',
      webhookId: 'webhook-1',
      purpose: 'webhook_signing',
      secretVersion: 4,
      encryptionKeyVersion: 1,
      aadVersion: 1
    };
    let encrypted = await keyring.encrypt({
      secret: 'signal-material',
      entityId: signalSigningSecretContext(v1),
      encryptionKeyVersion: 1,
      aadVersion: 1
    });
    let plaintext = await keyring.decrypt({
      encrypted,
      entityId: signalSigningSecretContext(v1),
      encryptionKeyVersion: 1,
      aadVersion: 1
    });
    let v2 = { ...v1, encryptionKeyVersion: 2, aadVersion: 2 };
    let reencrypted = await keyring.encrypt({
      secret: plaintext,
      entityId: signalSigningSecretContext(v2),
      encryptionKeyVersion: 2,
      aadVersion: 2
    });
    await expect(
      keyring.decrypt({
        encrypted: reencrypted,
        entityId: signalSigningSecretContext(v2),
        encryptionKeyVersion: 2,
        aadVersion: 2
      })
    ).resolves.toBe('signal-material');
    expect({
      secretVersion: v2.secretVersion,
      validUntil: 'unchanged',
      receipt: 'unchanged'
    }).toEqual({ secretVersion: 4, validUntil: 'unchanged', receipt: 'unchanged' });
    expect(() => signalSigningSecretContext({ ...v2, aadVersion: 3 })).toThrow(
      'Unsupported Signal signing AAD grammar'
    );
  });

  it('transactionally migrates and repairs legacy writer drift without issuing a receipt', async () => {
    let keyring = new VersionedEncryptionKeyring({
      keys: { 1: 'signal-test-encryption-key' },
      activeKeyVersion: 1,
      supportedAadVersions: [1]
    });
    let currentContext = {
      tenantId: 'tenant-1',
      webhookId: 'webhook-1',
      purpose: 'webhook_signing',
      secretVersion: 1,
      encryptionKeyVersion: 1,
      aadVersion: 1
    };
    let current = {
      oid: 40n,
      id: 'secret-1',
      webhookDestinationWebhookOid: 20n,
      tenantOid: 10n,
      purpose: 'webhook_signing',
      encryptedValue: await keyring.encrypt({
        entityId: signalSigningSecretContext(currentContext),
        secret: 'legacy-v1',
        encryptionKeyVersion: 1,
        aadVersion: 1
      }),
      secretVersion: 1,
      encryptionKeyVersion: 1,
      aadVersion: 1,
      status: 'active',
      validFrom: new Date('2026-08-13T00:00:00.000Z'),
      validUntil: null,
      createdAt: new Date('2026-08-13T00:00:00.000Z'),
      rotatedAt: null,
      revokedAt: null
    };
    let create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => data);
    let updateMany = vi.fn(async () => ({ count: 1 }));
    let auditCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => data);
    let tx = {
      webhookDestinationSigningSecret: {
        findFirst: vi.fn(async () => current),
        updateMany,
        create
      },
      webhookSecretAuditRecord: { create: auditCreate }
    };
    let now = new Date('2026-08-14T00:00:00.000Z');
    let result =
      await webhookDestinationSigningSecretService.reconcileImportedLegacyInTransaction({
        tx: tx as never,
        tenant: { oid: 10n, id: 'tenant-1' } as never,
        webhook: {
          oid: 20n,
          id: 'webhook-1',
          tenantOid: 10n
        } as never,
        plaintext: 'old-app-v2',
        now
      });

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'retiring', rotatedAt: now })
      })
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ secretVersion: 2, status: 'active' })
      })
    );
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'secret_rotated' }) })
    );
    expect(result).not.toHaveProperty('receipt');
  });
});
