import { beforeEach, describe, expect, it, vi } from 'vitest';

// @ts-ignore
const { db } = await import('@metorial/db');

vi.mock('@metorial/db', () => ({
  db: {
    outpostTokenKeyPair: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    }
  },
  withTransaction: (fn: any) => fn(db),
  ID: { generateId: vi.fn().mockResolvedValue('otkp_new') }
}));
vi.mock('@lowerdeck/service', () => ({
  Service: { create: (_: string, fn: any) => ({ build: () => fn() }) }
}));
const usingLock = vi.fn((_key: string, fn: any) => fn({ passForNow: () => {} }));
vi.mock('@metorial/lock', () => ({
  createLock: () => ({ usingLock })
}));
vi.mock('@metorial/fabric', () => ({ Fabric: { fire: vi.fn() } }));
vi.mock('@metorial/audit-scope', () => ({ createSystemAuditScope: () => ({ scope: true }) }));
vi.mock('../src/env', () => ({
  env: { secrets: { OUTPOST_KEY_ENCRYPTION_SECRET: 'test-secret' } }
}));

const { Fabric } = await import('@metorial/fabric');
const { outpostTokenKeyPairService } = await import('../src/services/outpostTokenKeyPair');
const { OUTPOST_KEY_SIGNING_WINDOW_MS, OUTPOST_KEY_VERIFY_GRACE_MS } =
  await import('../src/lib/constants');

let outpost = { oid: 100n, id: 'otp_1', accountOid: 1n, organizationOid: 2n } as any;
let organization = { oid: 2n, id: 'org_1' } as any;

let futureKeyPair = (overrides: Record<string, unknown> = {}) => ({
  oid: 900n,
  id: 'otkp_existing',
  status: 'active',
  accountOid: 1n,
  organizationOid: 2n,
  publicKey: Buffer.from([1, 2, 3]),
  privateKeyEncrypted: Buffer.from([4, 5, 6]),
  stopSigningAt: new Date(Date.now() + 60_000),
  stopVerifyingAt: new Date(Date.now() + 120_000),
  organization,
  ...overrides
});

describe('outpostTokenKeyPairService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.outpostTokenKeyPair.findMany as any).mockResolvedValue([]);
  });

  it('reuses the outpost account/org keypair that is still within its signing window', async () => {
    let existing = futureKeyPair();
    (db.outpostTokenKeyPair.findFirst as any).mockResolvedValue(existing);

    let keyPair = await outpostTokenKeyPairService.getSigningKeyPair({ outpost });

    expect(keyPair).toBe(existing);
    expect(db.outpostTokenKeyPair.create).not.toHaveBeenCalled();

    let where = (db.outpostTokenKeyPair.findFirst as any).mock.calls[0][0].where;
    expect(where).toMatchObject({ accountOid: 1n, organizationOid: 2n, status: 'active' });
  });

  it('lazily creates a keypair with the configured rotation windows when none can sign', async () => {
    (db.outpostTokenKeyPair.findFirst as any).mockResolvedValue(null);
    (db.outpostTokenKeyPair.create as any).mockImplementation(({ data }: any) => ({
      ...data,
      oid: 901n,
      organization
    }));

    let keyPair = await outpostTokenKeyPairService.getSigningKeyPair({ outpost });

    expect(keyPair.id).toBe('otkp_new');
    expect(keyPair.status).toBe('active');

    let elapsed = keyPair.stopSigningAt.getTime() - Date.now();
    expect(Math.abs(elapsed - OUTPOST_KEY_SIGNING_WINDOW_MS)).toBeLessThan(5_000);
    expect(keyPair.stopVerifyingAt.getTime() - keyPair.stopSigningAt.getTime()).toBe(
      OUTPOST_KEY_VERIFY_GRACE_MS
    );

    expect(Fabric.fire).toHaveBeenCalledWith(
      'outpost_token_key_pair.created:after',
      expect.objectContaining({ keyPair })
    );
  });

  it('takes a distributed lock and re-checks before creating, so concurrent registrations share one keypair', async () => {
    let raced = futureKeyPair();
    (db.outpostTokenKeyPair.findFirst as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(raced);

    let keyPair = await outpostTokenKeyPairService.getSigningKeyPair({ outpost });

    expect(usingLock).toHaveBeenCalledWith(
      `${outpost.accountOid}-${outpost.organizationOid}`,
      expect.any(Function)
    );
    expect(keyPair).toBe(raced);
    expect(db.outpostTokenKeyPair.create).not.toHaveBeenCalled();
  });

  it('never stores the private key in the clear and can decrypt it back for signing', async () => {
    (db.outpostTokenKeyPair.findFirst as any).mockResolvedValue(null);

    let created: any;
    (db.outpostTokenKeyPair.create as any).mockImplementation(({ data }: any) => {
      created = { ...data, oid: 901n, organization };
      return created;
    });

    await outpostTokenKeyPairService.getSigningKeyPair({ outpost });

    expect(created.privateKeyEncrypted).toBeInstanceOf(Buffer);
    expect(created).not.toHaveProperty('privateKey');

    (db.outpostTokenKeyPair.findFirst as any).mockResolvedValue(created);
    let tokens = await outpostTokenKeyPairService.getSigningTokens({ outpost });
    let token = await tokens.sign({ type: 'metorial-outpost-instance', data: { a: 1 } });

    expect(
      (await tokens.verify({ token, expectedType: 'metorial-outpost-instance' })).verified
    ).toBe(true);
  });

  describe('demoteElapsedKeyPairs', () => {
    it('demotes keypairs past their signing window to replaced', async () => {
      let elapsed = futureKeyPair({ stopSigningAt: new Date(Date.now() - 1_000) });
      (db.outpostTokenKeyPair.findMany as any)
        .mockResolvedValueOnce([elapsed])
        .mockResolvedValueOnce([]);

      let result = await outpostTokenKeyPairService.demoteElapsedKeyPairs({});

      expect(result).toEqual({ replaced: 1, expired: 0 });
      expect(db.outpostTokenKeyPair.updateMany).toHaveBeenCalledWith({
        where: { oid: { in: [elapsed.oid] } },
        data: { status: 'replaced' }
      });
      expect(Fabric.fire).toHaveBeenCalledWith(
        'outpost_token_key_pair.replaced:after',
        expect.objectContaining({ previousKeyPair: elapsed })
      );
    });

    it('demotes keypairs past their verification window to expired', async () => {
      let elapsed = futureKeyPair({
        status: 'replaced',
        stopVerifyingAt: new Date(Date.now() - 1_000)
      });
      (db.outpostTokenKeyPair.findMany as any)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([elapsed]);

      let result = await outpostTokenKeyPairService.demoteElapsedKeyPairs({});

      expect(result).toEqual({ replaced: 0, expired: 1 });
      expect(db.outpostTokenKeyPair.updateMany).toHaveBeenCalledWith({
        where: { oid: { in: [elapsed.oid] } },
        data: { status: 'expired' }
      });
    });

    it('audits a keypair that passed both windows in one sweep only as expired', async () => {
      let elapsed = futureKeyPair({
        stopSigningAt: new Date(Date.now() - 2_000),
        stopVerifyingAt: new Date(Date.now() - 1_000)
      });
      (db.outpostTokenKeyPair.findMany as any)
        .mockResolvedValueOnce([elapsed])
        .mockResolvedValueOnce([elapsed]);

      await outpostTokenKeyPairService.demoteElapsedKeyPairs({});

      let events = (Fabric.fire as any).mock.calls.map((call: any[]) => call[0]);
      expect(events).toEqual(['outpost_token_key_pair.expired:after']);
    });
  });

  describe('getVerificationPublicKey', () => {
    it('returns the encoded public key for a keypair that can still verify', async () => {
      (db.outpostTokenKeyPair.findUnique as any).mockResolvedValue(futureKeyPair());

      expect(
        await outpostTokenKeyPairService.getVerificationPublicKey({ kid: 'otkp_existing' })
      ).toBe(Buffer.from([1, 2, 3]).toString('base64url'));
    });

    it.each(['expired', 'revoked'])('refuses a %s keypair', async status => {
      (db.outpostTokenKeyPair.findUnique as any).mockResolvedValue(futureKeyPair({ status }));

      expect(
        await outpostTokenKeyPairService.getVerificationPublicKey({ kid: 'otkp_existing' })
      ).toBeUndefined();
    });

    it('refuses a keypair whose verification window has elapsed even if still marked active', async () => {
      (db.outpostTokenKeyPair.findUnique as any).mockResolvedValue(
        futureKeyPair({ stopVerifyingAt: new Date(Date.now() - 1_000) })
      );

      expect(
        await outpostTokenKeyPairService.getVerificationPublicKey({ kid: 'otkp_existing' })
      ).toBeUndefined();
    });

    it('refuses an unknown kid', async () => {
      (db.outpostTokenKeyPair.findUnique as any).mockResolvedValue(null);

      expect(
        await outpostTokenKeyPairService.getVerificationPublicKey({ kid: 'otkp_nope' })
      ).toBeUndefined();
    });
  });
});
