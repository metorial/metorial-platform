import { beforeEach, describe, expect, it, vi } from 'vitest';

let { mockDb } = vi.hoisted(() => ({
  mockDb: {
    networkPolicy: {
      create: vi.fn(),
      update: vi.fn(),
      findFirstOrThrow: vi.fn()
    },
    networkPolicyVersion: {
      create: vi.fn()
    },
    firewallNetworkPolicy: {
      count: vi.fn(),
      deleteMany: vi.fn()
    }
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: mockDb,
  withTransaction: async (cb: (db: typeof mockDb) => Promise<unknown>) => cb(mockDb),
  getId: (model: string) => ({
    oid: BigInt(model === 'networkPolicy' ? 1 : 2),
    id: `${model}_test_id`
  })
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn()
}));

vi.mock('../lib/networkPolicyValidation', () => ({
  validateNetworkPolicyRules: (rules: unknown[]) => rules
}));

import { networkPolicyService } from './networkPolicy';

let tenant = { oid: BigInt(10), id: 'ktn_test' } as any;
let environment = { oid: BigInt(20), id: 'ken_test' } as any;

describe('networkPolicyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a policy with version 1', async () => {
    mockDb.networkPolicy.create.mockResolvedValueOnce({
      oid: BigInt(1),
      id: 'npo_test',
      currentVersionNumber: 0
    });
    mockDb.networkPolicyVersion.create.mockResolvedValueOnce({
      oid: BigInt(2),
      id: 'npv_test',
      version: 1,
      rules: [{ id: 'rule_1' }]
    });
    mockDb.networkPolicy.update.mockResolvedValueOnce({
      oid: BigInt(1),
      id: 'npo_test',
      currentVersionNumber: 1,
      currentVersion: { version: 1, rules: [{ id: 'rule_1' }] },
      firewallLinks: []
    });

    let result = await networkPolicyService.createNetworkPolicy({
      tenant,
      environment,
      input: {
        name: 'Ingress policy',
        rules: [{ id: 'rule_1' } as any]
      }
    });

    expect(mockDb.networkPolicyVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        version: 1,
        networkPolicyOid: BigInt(1)
      })
    });
    expect(mockDb.networkPolicy.update).toHaveBeenCalledWith({
      where: { oid: BigInt(1) },
      data: {
        currentVersionOid: BigInt(2),
        currentVersionNumber: 1
      },
      include: expect.any(Object)
    });
    expect(result.currentVersionNumber).toBe(1);
  });

  it('increments version when rules are updated', async () => {
    mockDb.networkPolicyVersion.create.mockResolvedValueOnce({
      oid: BigInt(3),
      id: 'npv_v2',
      version: 2
    });
    mockDb.networkPolicy.update.mockResolvedValueOnce({
      oid: BigInt(1),
      id: 'npo_test',
      currentVersionNumber: 2,
      currentVersion: { version: 2, rules: [{ id: 'rule_2' }] },
      firewallLinks: [{ firewall: { id: 'fwl_a' } }, { firewall: { id: 'fwl_b' } }]
    });

    let result = await networkPolicyService.updateNetworkPolicy({
      tenant,
      environment,
      networkPolicy: {
        oid: BigInt(1),
        id: 'npo_test',
        tenantOid: tenant.oid,
        environmentOid: environment.oid,
        currentVersionNumber: 1,
        currentVersionOid: BigInt(2),
        currentVersion: { version: 1 }
      } as any,
      input: {
        rules: [{ id: 'rule_2' } as any]
      }
    });

    expect(mockDb.networkPolicyVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        version: 2
      })
    });
    expect(result.currentVersionNumber).toBe(2);
  });
});
