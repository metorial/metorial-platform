import { beforeEach, describe, expect, it, vi } from 'vitest';

let fire = vi.fn();

let core = {
  networkPolicy: { findUnique: vi.fn(), updateMany: vi.fn() },
  firewall: { findUnique: vi.fn(), updateMany: vi.fn() }
};

let mirror = {
  networkPolicy: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  networkPolicyVersion: { findMany: vi.fn(), create: vi.fn() }
};

vi.mock('@metorial/db', () => ({ db: core }));
vi.mock('@metorial/fabric', () => ({ Fabric: { fire } }));
vi.mock('@metorial-subspace/db', () => ({
  db: mirror,
  getId: (name: string) => ({ oid: 1n, id: `${name}_generated` })
}));
vi.mock('@metorial-subspace/module-tenant', () => ({
  subspaceScopeService: {
    ensureForInstance: vi.fn(async () => ({
      tenant: { oid: 10n, projectOid: 11n },
      environment: { oid: 12n, instanceOid: 13n }
    }))
  }
}));

let { mirrorNetworkPolicy } = await import('../src/internal/subspaceMirror');

let source = {
  oid: 1n,
  id: 'npo_1',
  name: 'Policy',
  description: null,
  status: 'active',
  archivedAt: null,
  revision: 4,
  currentVersionNumber: 2,
  createdAt: new Date(),
  instance: { oid: 13n },
  currentVersion: { id: 'npv_2' },
  versions: [
    { id: 'npv_2', version: 2, rules: [], createdAt: new Date() },
    { id: 'npv_1', version: 1, rules: [], createdAt: new Date() }
  ]
};

describe('mirrorNetworkPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    core.networkPolicy.findUnique.mockResolvedValue(source);
    mirror.networkPolicy.findUnique.mockResolvedValue({ oid: 50n, id: 'npo_1' });
    mirror.networkPolicyVersion.findMany.mockResolvedValue([]);
    mirror.networkPolicyVersion.create.mockImplementation(async ({ data }: any) => ({
      id: data.id,
      oid: BigInt(data.version) + 100n
    }));
  });

  it('does nothing when the source is gone', async () => {
    core.networkPolicy.findUnique.mockResolvedValue(null);

    expect(await mirrorNetworkPolicy({ networkPolicyId: 'npo_1' })).toBe(false);
    expect(fire).not.toHaveBeenCalled();
  });

  it('creates missing versions in order and points at the current one', async () => {
    await mirrorNetworkPolicy({ networkPolicyId: 'npo_1' });

    expect(mirror.networkPolicyVersion.create.mock.calls.map(c => c[0].data.id)).toEqual([
      'npv_1',
      'npv_2'
    ]);
    expect(mirror.networkPolicy.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentVersionOid: 102n, sourceRevision: 4 })
      })
    );
  });

  it('skips versions that already exist, so repeated runs are idempotent', async () => {
    mirror.networkPolicyVersion.findMany.mockResolvedValue([
      { id: 'npv_1', oid: 101n },
      { id: 'npv_2', oid: 102n }
    ]);

    await mirrorNetworkPolicy({ networkPolicyId: 'npo_1' });

    expect(mirror.networkPolicyVersion.create).not.toHaveBeenCalled();
    expect(mirror.networkPolicy.create).not.toHaveBeenCalled();
  });

  it('clears the sync flag only for the revision it mirrored', async () => {
    await mirrorNetworkPolicy({ networkPolicyId: 'npo_1' });

    expect(core.networkPolicy.updateMany).toHaveBeenCalledWith({
      where: { oid: 1n, revision: 4 },
      data: { needsSubspaceSync: false, subspaceSyncedRevision: 4 }
    });
    expect(fire).toHaveBeenCalledWith('networking.network_policy.mirrored:after', {
      networkPolicyId: 'npo_1'
    });
  });
});
