import { beforeEach, describe, expect, it, vi } from 'vitest';

let { mockDb } = vi.hoisted(() => ({
  mockDb: {
    firewall: {
      findFirst: vi.fn()
    },
    enclave: {
      updateMany: vi.fn()
    }
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: mockDb,
  Prisma: {
    JsonNull: 'JsonNull'
  }
}));

import {
  resetCompiledNetworkRulesForBindingTargets,
  resetCompiledNetworkRulesForFirewallId
} from './resetCompiledNetworkRules';

describe('resetCompiledNetworkRulesForBindingTargets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resets enclaves linked to an enclave binding target', async () => {
    await resetCompiledNetworkRulesForBindingTargets({
      networkOid: BigInt(100),
      tenantOid: BigInt(10),
      environmentOid: BigInt(20),
      bindings: [{ enclaveOid: BigInt(300), providerOid: null, networkOid: null }]
    });

    expect(mockDb.enclave.updateMany).toHaveBeenCalledWith({
      where: {
        networkOid: BigInt(100),
        tenantOid: BigInt(10),
        environmentOid: BigInt(20),
        OR: [{ oid: { in: [BigInt(300)] } }]
      },
      data: { compiledNetworkRules: 'JsonNull' }
    });
  });

  it('resets enclaves linked to provider and network binding targets', async () => {
    await resetCompiledNetworkRulesForBindingTargets({
      networkOid: BigInt(100),
      tenantOid: BigInt(10),
      environmentOid: BigInt(20),
      bindings: [
        { enclaveOid: null, providerOid: BigInt(400), networkOid: null },
        { enclaveOid: null, providerOid: null, networkOid: BigInt(100) }
      ]
    });

    expect(mockDb.enclave.updateMany).toHaveBeenCalledWith({
      where: {
        networkOid: BigInt(100),
        tenantOid: BigInt(10),
        environmentOid: BigInt(20),
        OR: [
          { providerDeployment: { providerOid: { in: [BigInt(400)] } } },
          { networkOid: BigInt(100) }
        ]
      },
      data: { compiledNetworkRules: 'JsonNull' }
    });
  });

  it('resets linked enclaves for a firewall id', async () => {
    mockDb.firewall.findFirst.mockResolvedValueOnce({
      networkOid: BigInt(100),
      tenantOid: BigInt(10),
      environmentOid: BigInt(20),
      bindings: [{ enclaveOid: BigInt(300), providerOid: null, networkOid: null }]
    });

    await resetCompiledNetworkRulesForFirewallId('fwl_test');

    expect(mockDb.firewall.findFirst).toHaveBeenCalledWith({
      where: { id: 'fwl_test' },
      include: { bindings: true }
    });
    expect(mockDb.enclave.updateMany).toHaveBeenCalledWith({
      where: {
        networkOid: BigInt(100),
        tenantOid: BigInt(10),
        environmentOid: BigInt(20),
        OR: [{ oid: { in: [BigInt(300)] } }]
      },
      data: { compiledNetworkRules: 'JsonNull' }
    });
  });
});
