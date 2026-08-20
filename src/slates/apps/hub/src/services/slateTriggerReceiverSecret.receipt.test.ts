import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  let receipt = {
    oid: 10n,
    id: 'receipt-1',
    tokenHash: '',
    tenantOid: 1n,
    receiverOid: 2n,
    provisionedRouteId: null,
    secretClass: 'receiver_path',
    secretId: 'secret-1',
    encryptedMaterial: 'encrypted-material',
    status: 'issued',
    expiresAt: new Date('2030-01-01T00:10:00.000Z'),
    consumedAt: null as Date | null
  };
  let audits: Array<Record<string, unknown>> = [];
  let outbox: Array<Record<string, unknown>> = [];
  let failConsumedAuditOnce = false;
  let receiver: Record<string, any> | null = null;
  let validReceiver = () => ({
    oid: 2n,
    id: 'receiver-1',
    tenantOid: 1n,
    slateInstanceOid: 3n,
    callbackId: 'callback-1',
    callbackInstanceId: 'callback-instance-1',
    callbackOwnerVersion: 3,
    status: 'active',
    tombstonedAt: null,
    tenant: { oid: 1n, id: 'tenant-1' },
    slateInstance: { oid: 3n, id: 'instance-1', tenantOid: 1n }
  });
  let tx = {
    slateTriggerReceiver: {
      findUnique: vi.fn(async () => receiver)
    },
    secretIssuanceReceipt: {
      findFirst: vi.fn(async () => receipt),
      updateMany: vi.fn(async () => {
        if (receipt.status !== 'issued') return { count: 0 };
        receipt.status = 'consumed';
        receipt.consumedAt = new Date('2030-01-01T00:00:00.000Z');
        return { count: 1 };
      })
    },
    slateTriggerReceiverPathSecret: {
      findFirst: vi.fn(async () => ({
        oid: 20n,
        id: 'secret-1',
        receiverOid: 2n,
        tenantOid: 1n,
        status: 'active',
        validFrom: new Date('2029-01-01T00:00:00.000Z'),
        secretVersion: 1
      }))
    },
    webhookSecretAuditRecord: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (data.action === 'secret_issuance_receipt_consumed' && failConsumedAuditOnce) {
          failConsumedAuditOnce = false;
          throw new Error('injected audit failure');
        }
        audits.push(data);
        return data;
      })
    },
    webhookSecretOutboxRecord: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        outbox.push(data);
        return data;
      })
    }
  };
  let db = {
    $transaction: vi.fn(async (callback: (tx: typeof tx) => Promise<unknown>) => {
      let receiptSnapshot = { ...receipt };
      let auditLength = audits.length;
      let outboxLength = outbox.length;
      try {
        return await callback(tx);
      } catch (error) {
        Object.assign(receipt, receiptSnapshot);
        audits.length = auditLength;
        outbox.length = outboxLength;
        throw error;
      }
    })
  };
  return {
    receipt,
    audits,
    outbox,
    tx,
    db,
    encryption: { decrypt: vi.fn(async () => 'generated-path-secret') },
    resetReceiver: () => {
      receiver = validReceiver();
    },
    setReceiver: (value: Record<string, any> | null) => {
      receiver = value;
    },
    validReceiver,
    setFailConsumedAuditOnce: () => {
      failConsumedAuditOnce = true;
    }
  };
});

vi.mock('../db', () => ({ db: mocks.db }));
vi.mock('../encryption', () => ({ encryption: mocks.encryption }));
vi.mock('../id', () => {
  let next = 100n;
  return {
    getId: () => ({ oid: next++, id: `id-${next}` }),
    snowflake: { nextId: () => next++ }
  };
});

import { slateTriggerReceiverSecretService } from './slateTriggerReceiverSecret';

let input = {
  callbackReceiverOwner: {
    tenantId: 'tenant-1',
    receiverId: 'receiver-1',
    callbackId: 'callback-1',
    callbackInstanceId: 'callback-instance-1',
    receiverAuthorityVersion: 3
  },
  receiptId: 'receipt-1',
  token: 'opaque-token',
  actor: { actorId: 'trusted-service', requestId: 'request-1' },
  now: new Date('2030-01-01T00:00:00.000Z')
};

describe('Hub receiver-path issuance receipt transaction', () => {
  beforeEach(() => {
    mocks.resetReceiver();
    mocks.receipt.status = 'issued';
    mocks.receipt.consumedAt = null;
    mocks.audits.length = 0;
    mocks.outbox.length = 0;
    vi.clearAllMocks();
  });

  it('returns generated material once and audits a replay denial separately', async () => {
    await expect(
      slateTriggerReceiverSecretService.consumePathReceipt(input)
    ).resolves.toMatchObject({ plaintext: 'generated-path-secret' });
    expect(mocks.receipt.status).toBe('consumed');
    expect(mocks.audits.map(record => record.action)).toContain(
      'secret_issuance_receipt_consumed'
    );
    expect(mocks.tx.slateTriggerReceiver.findUnique).toHaveBeenCalledOnce();

    await expect(slateTriggerReceiverSecretService.consumePathReceipt(input)).rejects.toThrow(
      'Secret issuance receipt was denied'
    );
    expect(mocks.receipt.status).toBe('consumed');
    expect(mocks.audits.map(record => record.action)).toContain(
      'secret_issuance_receipt_denied'
    );
    expect(mocks.tx.slateTriggerReceiver.findUnique).toHaveBeenCalledTimes(2);
  });

  it('rolls receipt consumption back when the same-transaction audit fails', async () => {
    mocks.setFailConsumedAuditOnce();
    await expect(slateTriggerReceiverSecretService.consumePathReceipt(input)).rejects.toThrow(
      'Secret issuance receipt was denied'
    );
    expect(mocks.receipt.status).toBe('issued');
    expect(mocks.audits.map(record => record.action)).toEqual([
      'secret_issuance_receipt_denied'
    ]);

    await expect(
      slateTriggerReceiverSecretService.consumePathReceipt(input)
    ).resolves.toMatchObject({ plaintext: 'generated-path-secret' });
    expect(mocks.receipt.status).toBe('consumed');
  });

  it.each([
    ['wrong receiver', null],
    ['wrong tenant', { tenant: { oid: 2n, id: 'tenant-other' }, tenantOid: 2n }],
    ['wrong callback', { callbackId: 'callback-other' }],
    ['stale authority', { callbackOwnerVersion: 4 }],
    ['detached receiver', { status: 'inactive' }],
    ['deleted receiver', { tombstonedAt: new Date('2026-08-15T00:00:00.000Z') }]
  ])('audits a %s denial after exactly one live owner lookup', async (_label, override) => {
    mocks.setReceiver(override === null ? null : { ...mocks.validReceiver(), ...override });

    await expect(slateTriggerReceiverSecretService.consumePathReceipt(input)).rejects.toThrow(
      'Secret issuance receipt was denied'
    );

    expect(mocks.tx.slateTriggerReceiver.findUnique).toHaveBeenCalledOnce();
    expect(mocks.tx.secretIssuanceReceipt.findFirst).not.toHaveBeenCalled();
    expect(mocks.audits).toHaveLength(1);
    expect(mocks.audits[0]).toMatchObject({
      action: 'secret_issuance_receipt_denied',
      tenantIdSnapshot: input.callbackReceiverOwner.tenantId,
      receiverIdSnapshot: input.callbackReceiverOwner.receiverId,
      callbackIdSnapshot: input.callbackReceiverOwner.callbackId,
      callbackInstanceIdSnapshot: input.callbackReceiverOwner.callbackInstanceId,
      receiverAuthorityVersionSnapshot: input.callbackReceiverOwner.receiverAuthorityVersion
    });
  });
});
