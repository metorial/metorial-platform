import { Encryption } from '@lowerdeck/encryption';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let { findSecrets, findWebhook } = vi.hoisted(() => ({
  findSecrets: vi.fn(),
  findWebhook: vi.fn()
}));
vi.mock('../db', () => ({
  db: {
    webhookDestinationWebhook: { findFirst: findWebhook },
    webhookDestinationSigningSecret: { findMany: findSecrets }
  }
}));
vi.mock('../env', () => ({
  env: {
    encryption: {
      ENCRYPTION_KEY: 'signal-delivery-key',
      ENCRYPTION_ACTIVE_KEY_VERSION: 1,
      ENCRYPTION_ACTIVE_AAD_VERSION: 1,
      ENCRYPTION_SUPPORTED_AAD_VERSIONS: '1'
    }
  }
}));

import {
  signalSecretMigrationMetrics,
  signalSigningSecretContext,
  webhookDestinationSigningSecretService
} from './webhookDestinationSigningSecret';

let webhook = {
  oid: 20n,
  id: 'webhook-1',
  tenantOid: 10n,
  tenant: { oid: 10n, id: 'tenant-1' },
  signingSecret: 'legacy-fallback'
};
let encryptRow = async (d: {
  id: string;
  status: 'active' | 'retiring' | 'revoked';
  secretVersion: number;
  plaintext: string;
  validUntil: Date | null;
}) => {
  let encryption = new Encryption('signal-delivery-key');
  return {
    oid: BigInt(30 + d.secretVersion),
    id: d.id,
    webhookDestinationWebhookOid: webhook.oid,
    tenantOid: webhook.tenantOid,
    purpose: 'webhook_signing',
    encryptedValue: await encryption.encrypt({
      entityId: signalSigningSecretContext({
        tenantId: webhook.tenant.id,
        webhookId: webhook.id,
        purpose: 'webhook_signing',
        secretVersion: d.secretVersion,
        encryptionKeyVersion: 1,
        aadVersion: 1
      }),
      secret: d.plaintext
    }),
    secretVersion: d.secretVersion,
    encryptionKeyVersion: 1,
    aadVersion: 1,
    status: d.status,
    validFrom: new Date(0),
    validUntil: d.validUntil,
    rotatedAt: null,
    revokedAt: d.status === 'revoked' ? new Date(50_000) : null,
    createdAt: new Date(0)
  };
};

beforeEach(() => {
  findWebhook.mockReset();
  findSecrets.mockReset();
  findWebhook.mockResolvedValue(webhook);
  signalSecretMigrationMetrics.legacyFallbacks = 0;
});

describe('Signal production delivery signing resolver', () => {
  it('selects active then retiring only before the exact expiry and excludes revoked', async () => {
    let active = await encryptRow({
      id: 'active',
      status: 'active',
      secretVersion: 3,
      plaintext: 'active-secret',
      validUntil: null
    });
    let retiring = await encryptRow({
      id: 'retiring',
      status: 'retiring',
      secretVersion: 2,
      plaintext: 'retiring-secret',
      validUntil: new Date(101_000)
    });
    let revoked = await encryptRow({
      id: 'revoked',
      status: 'revoked',
      secretVersion: 1,
      plaintext: 'revoked-secret',
      validUntil: null
    });
    findSecrets.mockResolvedValue([active, retiring, revoked]);

    await expect(
      webhookDestinationSigningSecretService.resolveActiveAndRetiring({
        tenantOid: webhook.tenantOid,
        webhookOid: webhook.oid,
        signingTimestampSeconds: 100
      })
    ).resolves.toMatchObject([
      { status: 'active', plaintext: 'active-secret', secretVersion: 3 },
      { status: 'retiring', plaintext: 'retiring-secret', secretVersion: 2 }
    ]);
    await expect(
      webhookDestinationSigningSecretService.resolveActiveAndRetiring({
        tenantOid: webhook.tenantOid,
        webhookOid: webhook.oid,
        signingTimestampSeconds: 101
      })
    ).resolves.toMatchObject([
      { status: 'active', plaintext: 'active-secret', secretVersion: 3 }
    ]);
  });

  it('falls back only for a legacy-only row and fails closed for encrypted revoked state', async () => {
    findSecrets.mockResolvedValueOnce([]);
    await expect(
      webhookDestinationSigningSecretService.resolveActiveAndRetiring({
        tenantOid: webhook.tenantOid,
        webhookOid: webhook.oid,
        signingTimestampSeconds: 100
      })
    ).resolves.toMatchObject([
      { plaintext: 'legacy-fallback', legacyFallback: true, secretVersion: 0 }
    ]);
    expect(signalSecretMigrationMetrics.legacyFallbacks).toBe(1);

    findSecrets.mockResolvedValueOnce([
      await encryptRow({
        id: 'revoked',
        status: 'revoked',
        secretVersion: 1,
        plaintext: 'must-not-resurrect',
        validUntil: null
      })
    ]);
    await expect(
      webhookDestinationSigningSecretService.resolveActiveAndRetiring({
        tenantOid: webhook.tenantOid,
        webhookOid: webhook.oid,
        signingTimestampSeconds: 100
      })
    ).rejects.toThrow('not readable');
    expect(signalSecretMigrationMetrics.legacyFallbacks).toBe(1);
  });
});
