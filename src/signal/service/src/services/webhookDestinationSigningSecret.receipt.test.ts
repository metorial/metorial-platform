import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  let receipt = {
    oid: 5n,
    id: 'receipt-1',
    secretId: 'secret-1',
    encryptedMaterial: 'encrypted-material',
    status: 'issued',
    expiresAt: new Date('2030-01-01T00:10:00.000Z'),
    consumedAt: null as Date | null
  };
  let audits: Array<Record<string, unknown>> = [];
  let failConsumedAuditOnce = false;
  let referencedSecretStatus: 'active' | 'retiring' | 'revoked' = 'active';
  let tx = {
    webhookDestinationWebhook: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        where.id === 'webhook-1' && where.tenantOid === 1n
          ? { oid: 2n, id: 'webhook-1', tenantOid: 1n }
          : null
      )
    },
    webhookSecretIssuanceReceipt: {
      findFirst: vi.fn(async () => receipt),
      updateMany: vi.fn(async () => {
        if (receipt.status !== 'issued') return { count: 0 };
        receipt.status = 'consumed';
        receipt.consumedAt = new Date('2030-01-01T00:00:00.000Z');
        return { count: 1 };
      })
    },
    webhookDestinationSigningSecret: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if (where.status === 'active' && referencedSecretStatus !== 'active') return null;
        return {
          oid: 7n,
          id: 'secret-1',
          webhookDestinationWebhookOid: 2n,
          tenantOid: 1n,
          purpose: 'webhook_signing',
          status: referencedSecretStatus,
          validFrom: new Date('2029-01-01T00:00:00.000Z'),
          validUntil:
            referencedSecretStatus === 'retiring'
              ? new Date('2030-01-01T00:00:30.000Z')
              : null,
          secretVersion: 1
        };
      })
    },
    webhookSecretAuditRecord: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (data.action === 'secret_issuance_receipt_consumed' && failConsumedAuditOnce) {
          failConsumedAuditOnce = false;
          throw new Error('injected signal audit failure');
        }
        audits.push(data);
        return data;
      })
    }
  };
  let db = {
    webhookDestinationWebhook: tx.webhookDestinationWebhook,
    $transaction: vi.fn(
      async (callback: (transaction: Record<string, any>) => Promise<unknown>) => {
        let receiptSnapshot = { ...receipt };
        let auditLength = audits.length;
        try {
          return await callback(tx);
        } catch (error) {
          Object.assign(receipt, receiptSnapshot);
          audits.length = auditLength;
          throw error;
        }
      }
    )
  };
  return {
    receipt,
    audits,
    db,
    decrypt: vi.fn(async () => 'generated-signing-secret'),
    setFailConsumedAuditOnce: () => {
      failConsumedAuditOnce = true;
    },
    setReferencedSecretStatus: (status: 'active' | 'retiring' | 'revoked') => {
      referencedSecretStatus = status;
    }
  };
});

vi.mock('@lowerdeck/encryption', () => ({
  Encryption: class {
    decrypt = mocks.decrypt;
    encrypt = vi.fn(async () => 'encrypted');
  }
}));
vi.mock('../db', () => ({ db: mocks.db }));
vi.mock('../env', () => ({ env: { encryption: { ENCRYPTION_KEY: 'test-key' } } }));
vi.mock('../id', () => {
  let next = 100n;
  return { getId: () => ({ oid: next++, id: `id-${next}` }) };
});

import { webhookDestinationSigningSecretService } from './webhookDestinationSigningSecret';

let input = {
  tenant: { oid: 1n, id: 'tenant-1' } as any,
  webhookId: 'webhook-1',
  receiptId: 'receipt-1',
  token: 'opaque-token',
  now: new Date('2030-01-01T00:00:00.000Z')
};

describe('Signal signing-secret issuance receipt transaction', () => {
  beforeEach(() => {
    mocks.receipt.status = 'issued';
    mocks.receipt.consumedAt = null;
    mocks.audits.length = 0;
    mocks.setReferencedSecretStatus('active');
    vi.clearAllMocks();
  });

  it('returns generated material once and records replay denial', async () => {
    await expect(
      webhookDestinationSigningSecretService.consumeReceipt(input)
    ).resolves.toMatchObject({ plaintext: 'generated-signing-secret' });
    await expect(webhookDestinationSigningSecretService.consumeReceipt(input)).rejects.toThrow(
      'invalid, expired, or consumed'
    );
    expect(mocks.receipt.status).toBe('consumed');
    expect(mocks.audits.map(record => record.action)).toEqual([
      'secret_issuance_receipt_consumed',
      'secret_issuance_receipt_denied'
    ]);
  });

  it('rolls back consumption when its audit write fails, then converges on retry', async () => {
    mocks.setFailConsumedAuditOnce();
    await expect(webhookDestinationSigningSecretService.consumeReceipt(input)).rejects.toThrow(
      'injected signal audit failure'
    );
    expect(mocks.receipt.status).toBe('issued');
    expect(mocks.audits.map(record => record.action)).toEqual([
      'secret_issuance_receipt_denied'
    ]);

    await expect(
      webhookDestinationSigningSecretService.consumeReceipt(input)
    ).resolves.toMatchObject({ plaintext: 'generated-signing-secret' });
    expect(mocks.receipt.status).toBe('consumed');
  });

  it('denies the wrong tenant and receipts for retiring or revoked secrets', async () => {
    await expect(
      webhookDestinationSigningSecretService.consumeReceipt({
        ...input,
        tenant: { oid: 999n, id: 'tenant-other' } as any
      })
    ).rejects.toThrow('owner not found');
    expect(mocks.receipt.status).toBe('issued');

    mocks.setReferencedSecretStatus('retiring');
    await expect(webhookDestinationSigningSecretService.consumeReceipt(input)).rejects.toThrow(
      'current active secret'
    );
    expect(mocks.receipt.status).toBe('issued');

    mocks.setReferencedSecretStatus('revoked');
    await expect(webhookDestinationSigningSecretService.consumeReceipt(input)).rejects.toThrow(
      'current active secret'
    );
    expect(mocks.receipt.status).toBe('issued');
  });
});
