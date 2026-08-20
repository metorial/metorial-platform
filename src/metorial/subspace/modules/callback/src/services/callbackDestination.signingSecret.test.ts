import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  getTenantForSignal: vi.fn(),
  rotateSigningSecret: vi.fn(),
  revokeSigningSecret: vi.fn(),
  consumeSigningSecretReceipt: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({ build: factory })
  }
}));
vi.mock('@metorial-subspace/db', () => ({
  CallbackDestinationStatus: {
    active: 'active',
    archived: 'archived',
    deleted: 'deleted'
  },
  db: { callbackDestination: {}, callbackDestinationLink: {} },
  getId: vi.fn()
}));
vi.mock('@metorial-subspace/list-utils', () => ({ normalizeDateFilter: vi.fn() }));
vi.mock('./callbackRegistration', () => ({ callbackRegistrationService: {} }));
vi.mock('../signal', () => ({
  getTenantForSignal: mocks.getTenantForSignal,
  signal: {
    eventDestination: {
      get: vi.fn(),
      rotateSigningSecret: mocks.rotateSigningSecret,
      revokeSigningSecret: mocks.revokeSigningSecret,
      consumeSigningSecretReceipt: mocks.consumeSigningSecretReceipt
    }
  }
}));

import { callbackDestinationService } from './callbackDestination';

let tenant = { oid: 1n, id: 'tenant-1' } as any;
let destination = {
  oid: 2n,
  id: 'callback-destination-1',
  signalEventDestinationId: 'signal-destination-1'
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getTenantForSignal.mockResolvedValue({ id: 'signal-tenant-1' });
});

describe('callback destination signing-secret authority', () => {
  it('routes rotate and revoke through the exact tenant-owned Signal destination', async () => {
    let rotated = {
      secret: { id: 'secret-2' },
      secretIssuanceReceipt: { id: 'receipt-2', token: 'receipt-token' }
    };
    mocks.rotateSigningSecret.mockResolvedValue(rotated);
    mocks.revokeSigningSecret.mockResolvedValue({ secret: { id: 'secret-1' } });

    await expect(
      callbackDestinationService.rotateSigningSecret({
        tenant,
        callbackDestination: destination,
        graceMs: 60_000
      })
    ).resolves.toBe(rotated);
    expect(mocks.rotateSigningSecret).toHaveBeenCalledWith({
      tenantId: 'signal-tenant-1',
      eventDestinationId: 'signal-destination-1',
      graceMs: 60_000
    });

    await callbackDestinationService.revokeSigningSecret({
      tenant,
      callbackDestination: destination,
      secretId: 'secret-1'
    });
    expect(mocks.revokeSigningSecret).toHaveBeenCalledWith({
      tenantId: 'signal-tenant-1',
      eventDestinationId: 'signal-destination-1',
      secretId: 'secret-1'
    });
  });

  it('fails closed before Signal access for unsynchronized owners and invalid grace periods', async () => {
    await expect(
      callbackDestinationService.rotateSigningSecret({
        tenant,
        callbackDestination: { ...destination, signalEventDestinationId: null },
        graceMs: 60_000
      })
    ).rejects.toThrow(/synchronized callback/i);
    await expect(
      callbackDestinationService.rotateSigningSecret({
        tenant,
        callbackDestination: destination,
        graceMs: 59_999
      })
    ).rejects.toThrow(/between one minute and seven days/i);

    expect(mocks.getTenantForSignal).not.toHaveBeenCalled();
    expect(mocks.rotateSigningSecret).not.toHaveBeenCalled();
  });

  it('consumes a receipt once and returns one non-enumerating denial outcome', async () => {
    mocks.consumeSigningSecretReceipt.mockResolvedValueOnce({ value: 'metorial_whsec_once' });
    await expect(
      callbackDestinationService.consumeSigningSecretReceipt({
        tenant,
        callbackDestination: destination,
        receiptId: 'receipt-1',
        receiptToken: 'receipt-token'
      })
    ).resolves.toEqual({ value: 'metorial_whsec_once' });
    expect(mocks.consumeSigningSecretReceipt).toHaveBeenCalledWith({
      tenantId: 'signal-tenant-1',
      eventDestinationId: 'signal-destination-1',
      receiptId: 'receipt-1',
      receiptToken: 'receipt-token'
    });

    mocks.consumeSigningSecretReceipt.mockRejectedValueOnce(new Error('expired'));
    await expect(
      callbackDestinationService.consumeSigningSecretReceipt({
        tenant,
        callbackDestination: destination,
        receiptId: 'receipt-1',
        receiptToken: 'receipt-token'
      })
    ).rejects.toThrow(/invalid, expired, or already consumed/i);
  });
});
