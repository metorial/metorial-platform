import { beforeEach, describe, expect, it, vi } from 'vitest';

// @ts-ignore
const { db } = await import('@metorial/db');

vi.mock('@metorial/db', () => ({
  db: {
    outpost: { findMany: vi.fn(), findFirst: vi.fn() },
    outpostCredential: { findFirst: vi.fn(), findFirstOrThrow: vi.fn() }
  }
}));
vi.mock('@lowerdeck/service', () => ({
  Service: { create: (_: string, fn: any) => ({ build: () => fn() }) }
}));

let cachedCredentialLookup = vi.fn();
let cachedManifest = vi.fn();
let cachedInstanceAuthorization = vi.fn();

vi.mock('../src/lib/cache', () => ({
  cachedCredentialLookup: (...args: any[]) => cachedCredentialLookup(...args),
  cachedManifest: (...args: any[]) => cachedManifest(...args),
  cachedInstanceAuthorization: (...args: any[]) => cachedInstanceAuthorization(...args)
}));

let registerInstance = vi.fn();
vi.mock('../src/services/outpostInstance', () => ({
  outpostInstanceService: { registerInstance: (...args: any[]) => registerInstance(...args) }
}));

const { outpostRegistrationService } = await import('../src/services/outpostRegistration');

let requestedBy = (outpostId: string) =>
  ({ outpostId, instanceId: 'oti_1', credentialId: 'otc_1' }) as any;

/** `rootOwnerAccountOid` is what links a child account back to the family it belongs to. */
let account = (oid: bigint, rootOwnerAccountOid?: bigint) => ({ oid, rootOwnerAccountOid });

describe('outpostRegistrationService family scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cachedCredentialLookup.mockResolvedValue({ status: 'ok', publicKey: 'AQID' });
    cachedManifest.mockResolvedValue({ status: 'ok', manifest: { access: [] } });
  });

  it('serves an unauthenticated lookup without a family check', async () => {
    let result = await outpostRegistrationService.resolveEnrollmentCredential({
      outpostId: 'otp_1',
      credentialId: 'otc_1'
    });

    expect(result.status).toBe('ok');
    expect(db.outpost.findMany).not.toHaveBeenCalled();
  });

  it('serves a requester reading its own outpost without a database round trip', async () => {
    await outpostRegistrationService.resolveManifest({
      outpostId: 'otp_1',
      requestedBy: requestedBy('otp_1')
    });

    expect(db.outpost.findMany).not.toHaveBeenCalled();
    expect(cachedManifest).toHaveBeenCalledWith({ outpostId: 'otp_1' });
  });

  it('serves a sibling outpost in the same account family', async () => {
    (db.outpost.findMany as any).mockResolvedValue([
      { id: 'otp_1', account: account(10n, 1n) },
      { id: 'otp_2', account: account(11n, 1n) }
    ]);

    let result = await outpostRegistrationService.resolveManifest({
      outpostId: 'otp_2',
      requestedBy: requestedBy('otp_1')
    });

    expect(result.status).toBe('ok');
  });

  it('reports an out-of-family manifest as unknown instead of leaking its existence', async () => {
    (db.outpost.findMany as any).mockResolvedValue([
      { id: 'otp_1', account: account(10n, 1n) },
      { id: 'otp_2', account: account(20n, 2n) }
    ]);

    let result = await outpostRegistrationService.resolveManifest({
      outpostId: 'otp_2',
      requestedBy: requestedBy('otp_1')
    });

    expect(result).toEqual({ status: 'unknown' });
    expect(cachedManifest).not.toHaveBeenCalled();
  });

  it('reports an out-of-family credential as unknown', async () => {
    (db.outpost.findMany as any).mockResolvedValue([
      { id: 'otp_1', account: account(10n) },
      { id: 'otp_2', account: account(20n) }
    ]);

    let result = await outpostRegistrationService.resolveEnrollmentCredential({
      outpostId: 'otp_2',
      credentialId: 'otc_2',
      requestedBy: requestedBy('otp_1')
    });

    expect(result).toEqual({ status: 'unknown' });
    expect(cachedCredentialLookup).not.toHaveBeenCalled();
  });

  it('reports an outpost it cannot load as unknown', async () => {
    (db.outpost.findMany as any).mockResolvedValue([{ id: 'otp_1', account: account(10n) }]);

    let result = await outpostRegistrationService.resolveManifest({
      outpostId: 'otp_missing',
      requestedBy: requestedBy('otp_1')
    });

    expect(result).toEqual({ status: 'unknown' });
  });
});

describe('outpostRegistrationService lookups', () => {
  beforeEach(() => vi.clearAllMocks());

  it('decodes the cached base64url public key back into bytes', async () => {
    cachedCredentialLookup.mockResolvedValue({
      status: 'ok',
      publicKey: Buffer.from([1, 2, 3]).toString('base64url')
    });

    let result = await outpostRegistrationService.resolveEnrollmentCredential({
      outpostId: 'otp_1',
      credentialId: 'otc_1'
    });

    expect(result).toEqual({ status: 'ok', publicKey: new Uint8Array([1, 2, 3]) });
  });

  it('passes through a revoked credential without a public key', async () => {
    cachedCredentialLookup.mockResolvedValue({ status: 'revoked' });

    expect(
      await outpostRegistrationService.resolveEnrollmentCredential({
        outpostId: 'otp_1',
        credentialId: 'otc_1'
      })
    ).toEqual({ status: 'revoked' });
  });

  it('resolves instance authorization through the cache', async () => {
    cachedInstanceAuthorization.mockResolvedValue({ status: 'instance_disabled' });

    let input = { outpostId: 'otp_1', instanceId: 'oti_1', credentialId: 'otc_1' };
    expect(await outpostRegistrationService.resolveInstanceAuthorization(input)).toEqual({
      status: 'instance_disabled'
    });
    expect(cachedInstanceAuthorization).toHaveBeenCalledWith(input);
  });
});

describe('outpostRegistrationService.onInstanceRegistered', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registers against the credential’s own outpost and returns the handshake result', async () => {
    let outpost = { id: 'otp_1', organization: { id: 'org_1' } };
    (db.outpostCredential.findFirstOrThrow as any).mockResolvedValue({
      id: 'otc_1',
      outpost
    });

    let expiresAt = new Date();
    registerInstance.mockResolvedValue({
      services: [{ id: 'mcp_connection_proxy', granted: true }],
      instanceTokenExpiresAt: expiresAt
    });

    let result = await outpostRegistrationService.onInstanceRegistered({
      outpostId: 'otp_1',
      credentialId: 'otc_1',
      instanceId: 'oti_1',
      instancePublicKey: new Uint8Array([1, 2, 3]),
      requestedServices: [{ id: 'mcp_connection_proxy', version: '1.0.0' }]
    });

    expect(result).toEqual({
      services: [{ id: 'mcp_connection_proxy', granted: true }],
      instanceTokenExpiresAt: expiresAt
    });

    expect(registerInstance).toHaveBeenCalledWith({
      outpost,
      credential: { id: 'otc_1', outpost },
      organization: outpost.organization,
      input: {
        identifier: 'oti_1',
        publicKey: new Uint8Array([1, 2, 3]),
        requestedServices: [{ id: 'mcp_connection_proxy', version: '1.0.0' }]
      }
    });
  });
});
