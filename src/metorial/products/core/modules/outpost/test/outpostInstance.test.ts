import { beforeEach, describe, expect, it, vi } from 'vitest';

// @ts-ignore
const { db } = await import('@metorial/db');

vi.mock('@metorial/db', () => ({
  db: {
    outpostInstance: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn()
    },
    outpostInstanceService: {
      upsert: vi.fn(),
      deleteMany: vi.fn()
    },
    outpostInstanceKeyRotation: { create: vi.fn() },
    outpostAccess: { findMany: vi.fn() },
    outpost: { update: vi.fn() }
  },
  withTransaction: (fn: any) => fn(db),
  ID: { generateId: vi.fn(async (prefix: string) => `${prefix}_mock`) }
}));
vi.mock('@lowerdeck/service', () => ({
  Service: { create: (_: string, fn: any) => ({ build: () => fn() }) }
}));
vi.mock('@metorial/fabric', () => ({ Fabric: { fire: vi.fn() } }));
vi.mock('@metorial/audit-scope', () => ({ createSystemAuditScope: () => ({ scope: true }) }));

const { Fabric } = await import('@metorial/fabric');
const { outpostInstanceService } = await import('../src/services/outpostInstance');
const { OUTPOST_INSTANCE_TOKEN_TTL_MS } = await import('../src/lib/constants');

let organization = { oid: 2n, id: 'org_1' } as any;
let outpost = { oid: 100n, id: 'otp_1', status: 'active', accountOid: 1n } as any;
let credential = { oid: 500n, id: 'otc_1', status: 'active' } as any;

let publicKey = new Uint8Array([1, 2, 3]);

let register = (
  input: Partial<Parameters<typeof outpostInstanceService.registerInstance>[0]['input']> = {}
) =>
  outpostInstanceService.registerInstance({
    outpost,
    credential,
    organization,
    input: {
      identifier: 'oti_789',
      publicKey,
      requestedServices: [],
      ...input
    }
  });

describe('outpostInstanceService.registerInstance', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (db.outpostInstance.findUnique as any).mockResolvedValue(null);
    (db.outpostInstance.upsert as any).mockImplementation(({ create }: any) => ({
      ...create,
      oid: 700n
    }));
    (db.outpostInstance.count as any).mockResolvedValue(1);
    (db.outpostAccess.findMany as any).mockResolvedValue([]);
    (db.outpostInstanceService.upsert as any).mockImplementation(({ create }: any) => create);
    (db.outpostInstanceService.deleteMany as any).mockResolvedValue({ count: 0 });
  });

  it('creates an active instance with a token expiry matching the configured TTL', async () => {
    let before = Date.now();
    let { instance, instanceTokenExpiresAt } = await register();

    expect(instance.status).toBe('active');
    expect(instance.registrationCount).toBe(1);
    expect(instance.credentialOid).toBe(credential.oid);
    expect(instanceTokenExpiresAt.getTime()).toBeGreaterThanOrEqual(
      before + OUTPOST_INSTANCE_TOKEN_TTL_MS
    );
    expect(instance.expiresAt).toEqual(instanceTokenExpiresAt);
  });

  it('reactivates and re-keys an existing instance on re-registration under the same identifier', async () => {
    (db.outpostInstance.findUnique as any).mockResolvedValue({
      oid: 700n,
      id: 'otn_1',
      status: 'inactive',
      publicKey: Buffer.from([1, 2, 3])
    });
    (db.outpostInstance.upsert as any).mockImplementation(({ update }: any) => ({
      oid: 700n,
      id: 'otn_1',
      ...update
    }));

    await register();

    let upsert = (db.outpostInstance.upsert as any).mock.calls[0][0];
    expect(upsert.where.outpostOid_identifier).toEqual({
      outpostOid: outpost.oid,
      identifier: 'oti_789'
    });
    expect(upsert.update.status).toBe('active');
    expect(upsert.update.registrationCount).toEqual({ increment: 1 });
    expect(db.outpostInstanceKeyRotation.create).not.toHaveBeenCalled();
  });

  it('records a key rotation when the instance comes back with a new public key', async () => {
    (db.outpostInstance.findUnique as any).mockResolvedValue({
      oid: 700n,
      id: 'otn_1',
      status: 'active',
      publicKey: Buffer.from([9, 9, 9])
    });
    (db.outpostInstance.upsert as any).mockImplementation(({ update }: any) => ({
      oid: 700n,
      id: 'otn_1',
      ...update
    }));
    (db.outpostInstance.update as any).mockImplementation(({ data }: any) => ({
      oid: 700n,
      id: 'otn_1',
      ...data
    }));

    await register();

    expect(db.outpostInstanceKeyRotation.create).toHaveBeenCalledTimes(1);
    expect(db.outpostInstance.update).toHaveBeenCalledWith({
      where: { oid: 700n },
      data: { keyRotationCount: { increment: 1 }, lastKeyRotationAt: expect.any(Date) }
    });
    expect(Fabric.fire).toHaveBeenCalledWith(
      'outpost_instance.key_rotated:after',
      expect.objectContaining({ outpost })
    );
  });

  describe('service handshake', () => {
    it('grants only the services the outpost has access to', async () => {
      (db.outpostAccess.findMany as any).mockResolvedValue([
        { services: ['outpost_registration_proxy'] }
      ]);

      let { services } = await register({
        requestedServices: [
          { id: 'outpost_registration_proxy', version: '1.2.0', capabilities: { a: 1 } },
          { id: 'mcp_connection_proxy' }
        ]
      });

      expect(services).toEqual([
        { id: 'outpost_registration_proxy', granted: true },
        { id: 'mcp_connection_proxy', granted: false }
      ]);
    });

    it('persists both granted and denied services with their version and capabilities', async () => {
      (db.outpostAccess.findMany as any).mockResolvedValue([
        { services: ['outpost_registration_proxy'] }
      ]);

      await register({
        requestedServices: [
          { id: 'outpost_registration_proxy', version: '1.2.0', capabilities: { a: 1 } },
          { id: 'mcp_connection_proxy' }
        ]
      });

      let created = (db.outpostInstanceService.upsert as any).mock.calls.map(
        (call: any[]) => call[0].create
      );
      expect(created).toEqual([
        expect.objectContaining({
          service: 'outpost_registration_proxy',
          version: '1.2.0',
          capabilities: { a: 1 },
          granted: true
        }),
        expect.objectContaining({
          service: 'mcp_connection_proxy',
          capabilities: {},
          granted: false
        })
      ]);
    });

    it('removes services the instance no longer reports', async () => {
      await register({ requestedServices: [{ id: 'mcp_connection_proxy' }] });

      expect(db.outpostInstanceService.deleteMany).toHaveBeenCalledWith({
        where: {
          instanceOid: 700n,
          service: { notIn: ['mcp_connection_proxy'] }
        }
      });
    });

    it('denies and warns about an unknown service id without failing the registration', async () => {
      let warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        let { services } = await register({
          requestedServices: [{ id: 'not_a_real_service' }]
        });

        expect(services).toEqual([{ id: 'not_a_real_service', granted: false }]);
        expect(db.outpostInstanceService.upsert).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledTimes(1);
      } finally {
        warn.mockRestore();
      }
    });

    it('grants nothing while the outpost is disabled', async () => {
      (db.outpostAccess.findMany as any).mockResolvedValue([
        { services: ['mcp_connection_proxy'] }
      ]);

      let { services } = await register({
        requestedServices: [{ id: 'mcp_connection_proxy' }]
      });
      expect(services).toEqual([{ id: 'mcp_connection_proxy', granted: true }]);

      let disabled = await outpostInstanceService.registerInstance({
        outpost: { ...outpost, status: 'disabled' },
        credential,
        organization,
        input: {
          identifier: 'oti_789',
          publicKey,
          requestedServices: [{ id: 'mcp_connection_proxy' }]
        }
      });

      expect(disabled.services).toEqual([{ id: 'mcp_connection_proxy', granted: false }]);
    });
  });

  it('recomputes the outpost instance count and connection status from active instances', async () => {
    (db.outpostInstance.count as any).mockResolvedValue(3);

    await register();

    expect(db.outpostInstance.count).toHaveBeenCalledWith({
      where: { outpostOid: outpost.oid, status: 'active' }
    });
    expect((db.outpost.update as any).mock.calls[0][0].data).toMatchObject({
      instanceCount: 3,
      connectionStatus: 'active'
    });
  });
});

describe('outpostInstanceService lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.outpostInstance.count as any).mockResolvedValue(0);
  });

  it('marks the outpost inactive once its last active instance is deactivated', async () => {
    let instance = { oid: 700n, id: 'otn_1', status: 'active' } as any;
    (db.outpostInstance.update as any).mockResolvedValue({ ...instance, status: 'inactive' });

    await outpostInstanceService.deactivateInstance({ instance, outpost, organization });

    expect((db.outpost.update as any).mock.calls[0][0].data).toMatchObject({
      instanceCount: 0,
      connectionStatus: 'inactive'
    });
    expect(Fabric.fire).toHaveBeenCalledWith(
      'outpost_instance.deactivated:after',
      expect.objectContaining({ previousInstance: instance })
    );
  });

  it('does not stamp lastSeenAt when refreshing the connection outside a registration', async () => {
    let instance = { oid: 700n, id: 'otn_1', status: 'active' } as any;
    (db.outpostInstance.update as any).mockResolvedValue({ ...instance, status: 'inactive' });

    await outpostInstanceService.deactivateInstance({ instance, outpost, organization });

    expect((db.outpost.update as any).mock.calls[0][0].data).not.toHaveProperty('lastSeenAt');
  });

  it('deletes an instance and refreshes the outpost count', async () => {
    let instance = { oid: 700n, id: 'otn_1', status: 'inactive' } as any;

    await outpostInstanceService.deleteInstance({ instance, outpost, organization });

    expect(db.outpostInstance.delete).toHaveBeenCalledWith({ where: { oid: 700n } });
    expect(db.outpost.update).toHaveBeenCalled();
    expect(Fabric.fire).toHaveBeenCalledWith(
      'outpost_instance.deleted:after',
      expect.objectContaining({ instance })
    );
  });
});

describe('outpostInstanceService.getInstanceAuthorization', () => {
  beforeEach(() => vi.clearAllMocks());

  let authorize = () =>
    outpostInstanceService.getInstanceAuthorization({
      outpostId: 'otp_1',
      instanceId: 'oti_789',
      credentialId: 'otc_1'
    });

  it('reports an unknown instance', async () => {
    (db.outpostInstance.findFirst as any).mockResolvedValue(null);
    expect(await authorize()).toBe('unknown');
  });

  it('reports an active instance', async () => {
    (db.outpostInstance.findFirst as any).mockResolvedValue({
      status: 'active',
      outpost: { status: 'active' },
      credential: { status: 'active' }
    });
    expect(await authorize()).toBe('active');
  });

  it('reports a disabled outpost', async () => {
    (db.outpostInstance.findFirst as any).mockResolvedValue({
      status: 'active',
      outpost: { status: 'disabled' },
      credential: { status: 'active' }
    });
    expect(await authorize()).toBe('outpost_disabled');
  });

  /** Disabling a credential has to lock out every instance that registered with it. */
  it('reports an instance whose credential was disabled', async () => {
    (db.outpostInstance.findFirst as any).mockResolvedValue({
      status: 'active',
      outpost: { status: 'active' },
      credential: { status: 'disabled' }
    });
    expect(await authorize()).toBe('instance_disabled');
  });

  it('reports a deactivated instance', async () => {
    (db.outpostInstance.findFirst as any).mockResolvedValue({
      status: 'inactive',
      outpost: { status: 'active' },
      credential: { status: 'active' }
    });
    expect(await authorize()).toBe('instance_disabled');
  });
});
