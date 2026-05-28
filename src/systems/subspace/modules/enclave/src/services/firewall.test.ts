import { beforeEach, describe, expect, it, vi } from 'vitest';

let { mockDb } = vi.hoisted(() => ({
  mockDb: {
    network: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn()
    },
    firewall: {
      create: vi.fn(),
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
      create: vi.fn()
    },
    enclave: {
      findFirst: vi.fn()
    },
    providerUse: {
      findFirst: vi.fn()
    },
    networkPolicy: {
      findMany: vi.fn()
    }
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: mockDb,
  withTransaction: async (cb: (db: typeof mockDb) => Promise<unknown>) => cb(mockDb),
  getId: (model: string) => ({
    oid: BigInt(model.length),
    id: `${model}_test_id`
  })
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
      bindings: [],
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

  it('replaces bindings when setFirewallBindings is called', async () => {
    mockDb.firewallBinding.deleteMany.mockResolvedValueOnce({ count: 2 });
    mockDb.network.findFirstOrThrow.mockResolvedValueOnce({
      oid: BigInt(100),
      id: 'net_test'
    });
    mockDb.enclave.findFirst.mockResolvedValueOnce({
      oid: BigInt(300),
      networkOid: BigInt(100)
    });
    mockDb.firewallBinding.findFirst.mockResolvedValue(null);
    mockDb.firewall.findFirstOrThrow.mockResolvedValueOnce({
      oid: BigInt(200),
      id: 'fwl_test',
      bindings: [],
      networkPolicyLinks: [],
      network: { id: 'net_test' }
    });

    await firewallService.setFirewallBindings({
      tenant,
      environment,
      firewall: {
        oid: BigInt(200),
        networkOid: BigInt(100),
        tenantOid: tenant.oid,
        environmentOid: environment.oid,
        network: { id: 'net_test' }
      } as any,
      bindings: [{ targetType: 'enclave', enclaveId: 'enc_test' }]
    });

    expect(mockDb.firewallBinding.deleteMany).toHaveBeenCalledWith({
      where: { firewallOid: BigInt(200) }
    });
    expect(mockDb.firewallBinding.create).toHaveBeenCalledTimes(1);
  });
});
