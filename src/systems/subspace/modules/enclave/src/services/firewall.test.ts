import { beforeEach, describe, expect, it, vi } from 'vitest';

let { mockDb } = vi.hoisted(() => ({
  mockDb: {
    network: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn()
    },
    firewall: {
      create: vi.fn(),
      update: vi.fn(),
      findFirstOrThrow: vi.fn(),
      delete: vi.fn()
    },
    firewallBinding: {
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn()
    },
    firewallNetworkPolicy: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn()
    },
    enclave: {
      findFirst: vi.fn()
    },
    providerUse: {
      findFirst: vi.fn()
    },
    networkPolicy: {
      findMany: vi.fn(),
      findFirst: vi.fn()
    }
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: mockDb,
  withTransaction: async (cb: (db: typeof mockDb) => Promise<unknown>) => cb(mockDb),
  addAfterTransactionHook: async (cb: () => Promise<void>) => cb(),
  getId: (model: string) => ({
    oid: BigInt(model.length),
    id: `${model}_test_id`
  })
}));

vi.mock('../queues/lifecycle/firewall', () => ({
  firewallCreatedQueue: { add: vi.fn() },
  firewallUpdatedQueue: { add: vi.fn() },
  firewallDeletedQueue: { add: vi.fn() }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn()
}));

vi.mock('../lib/firewallBindingValidation', () => ({
  validateFirewallBindingInputs: (bindings: unknown[]) => bindings
}));

vi.mock('@lowerdeck/id', () => ({
  generatePlainId: () => 'abcdefghij'
}));

vi.mock('@lowerdeck/slugify', () => ({
  slugify: (value: string) => value.toLowerCase().replace(/\s+/g, '-')
}));

import { firewallService } from './firewall';

let tenant = { oid: BigInt(10), id: 'ktn_test' } as any;
let environment = { oid: BigInt(20), id: 'ken_test' } as any;

describe('firewallService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a firewall with multiple bindings', async () => {
    mockDb.network.findFirst.mockResolvedValueOnce({
      oid: BigInt(100),
      id: 'net_test'
    });
    mockDb.firewall.create.mockResolvedValueOnce({
      oid: BigInt(200),
      id: 'fwl_test',
      networkOid: BigInt(100)
    });
    mockDb.enclave.findFirst.mockResolvedValueOnce({
      oid: BigInt(300),
      networkOid: BigInt(100)
    });
    mockDb.providerUse.findFirst.mockResolvedValueOnce({
      providerOid: BigInt(400)
    });
    mockDb.firewallBinding.findFirst.mockResolvedValue(null);
    mockDb.firewall.findFirstOrThrow.mockResolvedValueOnce({
      oid: BigInt(200),
      id: 'fwl_test',
      networkPolicyLinks: [],
      network: { id: 'net_test' }
    });

    await firewallService.createFirewall({
      tenant,
      environment,
      input: {
        name: 'Production API',
        networkId: 'net_test',
        bindings: [
          { targetType: 'enclave', enclaveId: 'enc_test' },
          { targetType: 'provider', providerId: 'pro_test' }
        ]
      }
    });

    expect(mockDb.firewallBinding.create).toHaveBeenCalledTimes(2);
  });

  it('replaces network policy links when update includes networkPolicyIds', async () => {
    mockDb.firewallNetworkPolicy.deleteMany.mockResolvedValueOnce({ count: 1 });
    mockDb.networkPolicy.findMany.mockResolvedValueOnce([
      { oid: BigInt(500), id: 'npo_a', status: 'active' },
      { oid: BigInt(501), id: 'npo_b', status: 'active' }
    ]);
    mockDb.firewall.update.mockResolvedValueOnce({
      oid: BigInt(200),
      id: 'fwl_test',
      networkPolicyLinks: [],
      network: { id: 'net_test' }
    });

    await firewallService.updateFirewall({
      tenant,
      environment,
      firewall: {
        oid: BigInt(200),
        id: 'fwl_test',
        status: 'active',
        tenantOid: tenant.oid,
        environmentOid: environment.oid
      } as any,
      input: {
        networkPolicyIds: ['npo_a', 'npo_b']
      }
    });

    expect(mockDb.firewallNetworkPolicy.deleteMany).toHaveBeenCalledWith({
      where: { firewallOid: BigInt(200) }
    });
    expect(mockDb.firewallNetworkPolicy.create).toHaveBeenCalledTimes(2);
  });

  it('adds a network policy link', async () => {
    mockDb.firewallNetworkPolicy.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockDb.networkPolicy.findFirst.mockResolvedValueOnce({
      oid: BigInt(500),
      id: 'npo_test',
      status: 'active'
    });
    mockDb.firewall.findFirstOrThrow.mockResolvedValueOnce({
      oid: BigInt(200),
      id: 'fwl_test',
      networkPolicyLinks: [],
      network: { id: 'net_test' }
    });

    await firewallService.addFirewallNetworkPolicy({
      tenant,
      environment,
      firewall: {
        oid: BigInt(200),
        id: 'fwl_test',
        status: 'active',
        tenantOid: tenant.oid,
        environmentOid: environment.oid
      } as any,
      networkPolicyId: 'npo_test'
    });

    expect(mockDb.firewallNetworkPolicy.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        firewallOid: BigInt(200),
        networkPolicyOid: BigInt(500),
        position: 0
      })
    });
  });

  it('removes a network policy link', async () => {
    mockDb.firewallNetworkPolicy.findFirst.mockResolvedValueOnce({
      oid: BigInt(600)
    });
    mockDb.firewall.findFirstOrThrow.mockResolvedValueOnce({
      oid: BigInt(200),
      id: 'fwl_test',
      networkPolicyLinks: [],
      network: { id: 'net_test' }
    });

    await firewallService.removeFirewallNetworkPolicy({
      tenant,
      environment,
      firewall: {
        oid: BigInt(200),
        id: 'fwl_test',
        status: 'active',
        tenantOid: tenant.oid,
        environmentOid: environment.oid
      } as any,
      networkPolicyId: 'npo_test'
    });

    expect(mockDb.firewallNetworkPolicy.delete).toHaveBeenCalledWith({
      where: { oid: BigInt(600) }
    });
  });

  it('archives a firewall without deleting bindings or policy links', async () => {
    mockDb.firewall.update.mockResolvedValueOnce({
      oid: BigInt(200),
      id: 'fwl_test',
      status: 'archived',
      networkPolicyLinks: [],
      network: { id: 'net_test' }
    });

    await firewallService.archiveFirewall({
      tenant,
      environment,
      firewall: {
        oid: BigInt(200),
        id: 'fwl_test',
        status: 'active',
        tenantOid: tenant.oid,
        environmentOid: environment.oid
      } as any
    });

    expect(mockDb.firewallBinding.deleteMany).not.toHaveBeenCalled();
    expect(mockDb.firewallNetworkPolicy.deleteMany).not.toHaveBeenCalled();
    expect(mockDb.firewall.delete).not.toHaveBeenCalled();
    expect(mockDb.firewall.update).toHaveBeenCalledWith({
      where: {
        oid: BigInt(200),
        tenantOid: tenant.oid,
        environmentOid: environment.oid
      },
      data: {
        status: 'archived',
        archivedAt: expect.any(Date)
      },
      include: expect.any(Object)
    });

    let { firewallDeletedQueue } = await import('../queues/lifecycle/firewall');
    expect(firewallDeletedQueue.add).toHaveBeenCalledWith({ firewallId: 'fwl_test' });
  });
});
