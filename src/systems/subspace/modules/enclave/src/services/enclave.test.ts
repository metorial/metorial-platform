import { beforeEach, describe, expect, it, vi } from 'vitest';

let { mockDb } = vi.hoisted(() => ({
  mockDb: {
    enclave: {
      findFirst: vi.fn(),
      updateMany: vi.fn()
    },
    firewallBinding: {
      findMany: vi.fn()
    }
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: mockDb,
  withTransaction: async (cb: (db: typeof mockDb) => Promise<unknown>) => cb(mockDb),
  addAfterTransactionHook: async (cb: () => Promise<void>) => cb()
}));

vi.mock('../queues/lifecycle/enclave', () => ({
  enclaveUpdatedQueue: { add: vi.fn() }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn()
}));

import { enclaveService } from './enclave';

let tenant = { oid: BigInt(10), id: 'ktn_test' } as any;
let environment = { oid: BigInt(20), id: 'ken_test' } as any;

let baseRule = {
  id: 'npr_test',
  effect: 'allow' as const,
  direction: 'ingress' as const,
  cidrs: ['10.0.0.0/8'],
  enabled: true,
  priority: 100
};

describe('enclaveService.compileNetworkRules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns raw rules and a compiled allow list for the requested direction', async () => {
    mockDb.enclave.findFirst.mockResolvedValueOnce({
      oid: BigInt(300),
      networkOid: BigInt(100),
      providerDeployment: {
        providerOid: BigInt(400)
      }
    });
    mockDb.firewallBinding.findMany.mockResolvedValueOnce([
      {
        firewall: {
          oid: BigInt(500),
          networkOid: BigInt(100),
          networkPolicyLinks: [
            {
              position: 0,
              networkPolicy: {
                currentVersion: {
                  rules: [baseRule]
                }
              }
            }
          ]
        }
      },
      {
        firewall: {
          oid: BigInt(501),
          networkOid: BigInt(200),
          networkPolicyLinks: [
            {
              position: 0,
              networkPolicy: {
                currentVersion: {
                  rules: [
                    {
                      ...baseRule,
                      id: 'npr_other_network'
                    }
                  ]
                }
              }
            }
          ]
        }
      }
    ]);

    let result = await enclaveService.compileNetworkRules({
      tenant,
      environment,
      direction: 'ingress',
      enclave: {
        oid: BigInt(300),
        id: 'enc_test',
        tenantOid: tenant.oid,
        environmentOid: environment.oid
      } as any
    });

    expect(mockDb.firewallBinding.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          firewall: { status: 'active' },
          OR: [
            { enclaveOid: BigInt(300) },
            { providerOid: BigInt(400) },
            { networkOid: BigInt(100) }
          ]
        })
      })
    );
    expect(result.rules).toEqual([baseRule]);
    expect(result.allowList.direction).toBe('ingress');
    expect(result.allowList.entries).toContainEqual({ cidr: '10.0.0.0/8' });
    expect(mockDb.enclave.updateMany).toHaveBeenCalledWith({
      where: { oid: BigInt(300) },
      data: { compiledNetworkRules: result.allowList }
    });
  });
});
