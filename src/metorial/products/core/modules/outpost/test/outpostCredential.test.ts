import { ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// @ts-ignore
const { db } = await import('@metorial/db');

vi.mock('@metorial/db', () => ({
  db: {
    outpostCredential: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn()
    }
  },
  withTransaction: (fn: any) => fn(db),
  ID: { generateId: vi.fn().mockResolvedValue('otc_mock') }
}));
vi.mock('@lowerdeck/service', () => ({
  Service: { create: (_: string, fn: any) => ({ build: () => fn() }) }
}));
vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));
vi.mock('@metorial/config', () => ({
  getConfig: () => ({ urls: { apiUrl: 'http://api.test' } })
}));
vi.mock('@metorial-outpost/server', () => ({ DEFAULT_BASE_PATH: '/outpost' }));
vi.mock('@metorial-outpost/crypto', () => ({
  Ed25519: {
    generateKeyPair: vi.fn().mockResolvedValue({ publicKey: 'pub', privateKey: 'priv' }),
    exportPublicKey: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    exportPrivateKey: vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6]))
  },
  base64url: { encode: (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url') }
}));
vi.mock('@metorial-outpost/credential-envelope', () => ({
  encodeCredentialEnvelope: (credential: any) =>
    `metorial_op_${Buffer.from(JSON.stringify(credential)).toString('base64url')}`
}));
vi.mock('@lowerdeck/pagination', () => ({
  Paginator: { create: (fn: any) => fn({ prisma: (cb: any) => cb({}) }) }
}));

const { outpostCredentialService } = await import('../src/services/outpostCredential');

const baseOrg = { oid: 1n, id: 'org_1' } as any;
const baseOutpost = { oid: 100n, id: 'otp_1' } as any;
let testAuditScope = {
  organizationOid: baseOrg.oid,
  actor: { type: 'org_actor' as const, id: 'actor_1' }
} as any;

describe('outpostCredentialService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a credential, returning a one-time envelope while persisting only the public key and preview', async () => {
    (db.outpostCredential.create as any).mockImplementation(({ data }: any) => ({
      ...data,
      oid: 500n
    }));

    let { credential, envelope } = await outpostCredentialService.createCredential({
      outpost: baseOutpost,
      organization: baseOrg,
      input: { name: 'CI Runner' },
      auditScope: testAuditScope
    });

    expect(envelope.startsWith('metorial_op_')).toBe(true);
    expect(credential.identifier).toBe('CI Runner');
    expect(credential.envelopePreview).toBe(
      `${envelope.slice(0, 16)}...${envelope.slice(-4)}`
    );

    let createCall = (db.outpostCredential.create as any).mock.calls[0][0];
    expect(createCall.data.publicKey).toBeInstanceOf(Buffer);
    expect(createCall.data).not.toHaveProperty('privateKey');
  });

  it('refuses to delete an active credential', async () => {
    let activeCredential = { oid: 500n, id: 'otc_1', status: 'active' } as any;

    await expect(
      outpostCredentialService.deleteCredential({
        credential: activeCredential,
        outpost: baseOutpost,
        organization: baseOrg,
        auditScope: testAuditScope
      })
    ).rejects.toBeInstanceOf(ServiceError);
    expect(db.outpostCredential.update).not.toHaveBeenCalled();
  });

  it('deletes a disabled credential', async () => {
    let disabledCredential = { oid: 500n, id: 'otc_1', status: 'disabled' } as any;
    (db.outpostCredential.update as any).mockResolvedValue({
      ...disabledCredential,
      status: 'deleted'
    });

    let credential = await outpostCredentialService.deleteCredential({
      credential: disabledCredential,
      outpost: baseOutpost,
      organization: baseOrg,
      auditScope: testAuditScope
    });

    expect(credential.status).toBe('deleted');
  });
});
