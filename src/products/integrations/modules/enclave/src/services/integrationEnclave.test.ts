import { beforeEach, describe, expect, it, vi } from 'vitest';

let { mockDb } = vi.hoisted(() => ({
  mockDb: {
    integrationEnclave: {
      findFirst: vi.fn(),
      updateMany: vi.fn()
    },
    integrationFirewallAssignment: {
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

import { integrationEnclaveService } from './integrationEnclave';

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

let enclave = {
  oid: BigInt(300),
  id: 'enc_test',
  tenantOid: tenant.oid,
  environmentOid: environment.oid,
  compiledNetworkRules: null
} as any;

describe('integrationEnclaveService.getCompiledNetworkRules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows all ingress and egress when no firewalls are applied', async () => {
    mockDb.integrationEnclave.findFirst.mockResolvedValueOnce({
      oid: BigInt(300),
      internetGatewayOid: BigInt(100),
      providerDeployment: {
        providerOid: BigInt(400)
      }
    });
    mockDb.integrationFirewallAssignment.findMany.mockResolvedValueOnce([]);

    let result = await integrationEnclaveService.getCompiledNetworkRulesInternal({
      tenant,
      environment,
      enclave
    });

    expect(result.ingress).toEqual({
      direction: 'ingress',
      entries: [{ cidr: '0.0.0.0/0' }, { cidr: '::/0' }]
    });
    expect(result.egress).toEqual({
      direction: 'egress',
      entries: [{ cidr: '0.0.0.0/0' }, { cidr: '::/0' }]
    });
    expect(mockDb.integrationEnclave.updateMany).toHaveBeenCalledWith({
      where: { oid: BigInt(300) },
      data: { compiledNetworkRules: result }
    });
  });

  it('compiles firewall rules when firewalls are applied', async () => {
    mockDb.integrationEnclave.findFirst.mockResolvedValueOnce({
      oid: BigInt(300),
      internetGatewayOid: BigInt(100),
      providerDeployment: {
        providerOid: BigInt(400)
      }
    });
    mockDb.integrationFirewallAssignment.findMany.mockResolvedValueOnce([
      {
        firewall: {
          oid: BigInt(500),
          internetGatewayOid: BigInt(100),
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
          internetGatewayOid: BigInt(200),
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

    let result = await integrationEnclaveService.getCompiledNetworkRulesInternal({
      tenant,
      environment,
      enclave
    });

    expect(mockDb.integrationFirewallAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          firewall: { status: 'active' },
          OR: [
            { enclaveOid: BigInt(300) },
            { providerOid: BigInt(400) },
            { internetGatewayOid: BigInt(100) }
          ]
        })
      })
    );
    expect(result.ingress.entries).toContainEqual({ cidr: '10.0.0.0/8' });
    expect(mockDb.integrationEnclave.updateMany).toHaveBeenCalledWith({
      where: { oid: BigInt(300) },
      data: { compiledNetworkRules: result }
    });
  });
});
