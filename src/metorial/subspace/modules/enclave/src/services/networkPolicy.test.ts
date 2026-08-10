import { beforeEach, describe, expect, it, vi } from 'vitest';

let { mockDb } = vi.hoisted(() => ({
  mockDb: {
    networkPolicy: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
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
  addAfterTransactionHook: async (cb: () => Promise<void>) => cb(),
  getId: (model: string) => ({
    oid: BigInt(model === 'networkPolicy' ? 1 : model === 'networkPolicyRule' ? 2 : 3),
    id: `${model}_test_id`
  })
}));

vi.mock('../queues/lifecycle/networkPolicy', () => ({
  networkPolicyCreatedQueue: { add: vi.fn() },
  networkPolicyUpdatedQueue: { add: vi.fn() },
  networkPolicyDeletedQueue: { add: vi.fn() }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn()
}));

vi.mock('../env', () => ({
  env: {
    service: {
      REDIS_URL: 'redis://localhost:6379'
    }
  }
}));

vi.mock('@lowerdeck/lock', () => ({
  createLock: () => ({
    usingLock: async (_keys: string[], cb: () => Promise<unknown>) => cb()
  })
}));

import { networkPolicyDeletedQueue } from '../queues/lifecycle/networkPolicy';
import { networkPolicyService } from './networkPolicy';

let tenant = { oid: BigInt(10), id: 'ktn_test' } as any;
let environment = { oid: BigInt(20), id: 'ken_test' } as any;

describe('networkPolicyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a policy with version 1 and generated rule ids', async () => {
    mockDb.networkPolicy.create.mockResolvedValueOnce({
      oid: BigInt(1),
      id: 'npo_test',
      currentVersionNumber: 0
    });
    mockDb.networkPolicyVersion.create.mockResolvedValueOnce({
      oid: BigInt(2),
      id: 'npv_test',
      version: 1
    });
    mockDb.networkPolicy.update.mockResolvedValueOnce({
      oid: BigInt(1),
      id: 'npo_test',
      currentVersionNumber: 1,
      currentVersion: {
        version: 1,
        rules: [{ ...baseRule(), id: 'networkPolicyRule_test_id' }]
      },
      firewallLinks: []
    });

    let result = await networkPolicyService.createNetworkPolicy({
      tenant,
      environment,
      input: {
        name: 'Ingress policy',
        rules: [baseRule()]
      }
    });

    expect(mockDb.networkPolicyVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        version: 1,
        rules: [expect.objectContaining({ id: 'networkPolicyRule_test_id' })],
        networkPolicyOid: BigInt(1)
      })
    });
    expect(result.currentVersionNumber).toBe(1);
  });

  it('adds a rule under lock and creates a new version', async () => {
    mockDb.networkPolicy.findFirst.mockResolvedValueOnce({
      oid: BigInt(1),
      id: 'npo_test',
      tenantOid: tenant.oid,
      environmentOid: environment.oid,
      currentVersionNumber: 1,
      currentVersion: {
        rules: [{ ...baseRule(), id: 'npr_existing' }]
      }
    });
    mockDb.networkPolicyVersion.create.mockResolvedValueOnce({
      oid: BigInt(3),
      id: 'npv_v2',
      version: 2
    });
    mockDb.networkPolicy.update.mockResolvedValueOnce({
      oid: BigInt(1),
      id: 'npo_test',
      currentVersionNumber: 2,
      currentVersion: {
        version: 2,
        rules: [
          { ...baseRule(), id: 'npr_existing' },
          {
            ...baseRule(),
            direction: 'egress',
            id: 'networkPolicyRule_test_id',
            ports: [{ from: 443, to: 443 }]
          }
        ]
      },
      firewallLinks: []
    });

    let result = await networkPolicyService.addNetworkPolicyRule({
      tenant,
      environment,
      networkPolicy: {
        oid: BigInt(1),
        id: 'npo_test',
        status: 'active',
        tenantOid: tenant.oid,
        environmentOid: environment.oid
      } as any,
      input: {
        rule: {
          ...baseRule(),
          direction: 'egress',
          ports: [{ from: 443, to: 443 }]
        }
      }
    });

    expect(mockDb.networkPolicy.findFirst).toHaveBeenCalled();
    expect(result.rule.id).toBe('networkPolicyRule_test_id');
    expect(result.networkPolicy.currentVersionNumber).toBe(2);
  });

  it('removes a rule by id and creates a new version', async () => {
    mockDb.networkPolicy.findFirst.mockResolvedValueOnce({
      oid: BigInt(1),
      id: 'npo_test',
      tenantOid: tenant.oid,
      environmentOid: environment.oid,
      currentVersionNumber: 2,
      currentVersion: {
        rules: [
          { ...baseRule(), id: 'npr_keep' },
          { ...baseRule(), id: 'npr_remove', cidrs: ['203.0.113.0/24'] }
        ]
      }
    });
    mockDb.networkPolicyVersion.create.mockResolvedValueOnce({
      oid: BigInt(4),
      id: 'npv_v3',
      version: 3
    });
    mockDb.networkPolicy.update.mockResolvedValueOnce({
      oid: BigInt(1),
      id: 'npo_test',
      currentVersionNumber: 3,
      currentVersion: {
        version: 3,
        rules: [{ ...baseRule(), id: 'npr_keep' }]
      },
      firewallLinks: []
    });

    let result = await networkPolicyService.removeNetworkPolicyRule({
      tenant,
      environment,
      networkPolicy: {
        oid: BigInt(1),
        id: 'npo_test',
        status: 'active',
        tenantOid: tenant.oid,
        environmentOid: environment.oid
      } as any,
      ruleId: 'npr_remove'
    });

    expect(mockDb.networkPolicyVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        version: 3,
        rules: [expect.objectContaining({ id: 'npr_keep' })]
      })
    });
    expect(result.currentVersionNumber).toBe(3);
  });

  it('replaces all rules on update and reuses unchanged rule ids', async () => {
    mockDb.networkPolicy.findFirst.mockResolvedValueOnce({
      oid: BigInt(1),
      id: 'npo_test',
      name: 'Ingress policy',
      description: null,
      tenantOid: tenant.oid,
      environmentOid: environment.oid,
      currentVersionNumber: 1,
      currentVersion: {
        rules: [
          { ...baseRule(), id: 'npr_keep' },
          { ...baseRule(), id: 'npr_remove', cidrs: ['203.0.113.0/24'] }
        ]
      }
    });
    mockDb.networkPolicyVersion.create.mockResolvedValueOnce({
      oid: BigInt(5),
      id: 'npv_v2',
      version: 2
    });
    mockDb.networkPolicy.update.mockResolvedValueOnce({
      oid: BigInt(1),
      id: 'npo_test',
      currentVersionNumber: 2,
      currentVersion: {
        version: 2,
        rules: [
          { ...baseRule(), id: 'npr_keep' },
          {
            ...baseRule(),
            direction: 'egress',
            id: 'networkPolicyRule_test_id',
            ports: [{ from: 443, to: 443 }]
          }
        ]
      },
      firewallLinks: []
    });

    let result = await networkPolicyService.updateNetworkPolicy({
      tenant,
      environment,
      networkPolicy: {
        oid: BigInt(1),
        id: 'npo_test',
        name: 'Ingress policy',
        description: null,
        status: 'active',
        tenantOid: tenant.oid,
        environmentOid: environment.oid
      } as any,
      input: {
        rules: [
          baseRule(),
          {
            ...baseRule(),
            direction: 'egress',
            ports: [{ from: 443, to: 443 }]
          }
        ]
      }
    });

    expect(mockDb.networkPolicyVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        version: 2,
        rules: [
          expect.objectContaining({ id: 'npr_keep' }),
          expect.objectContaining({ id: 'networkPolicyRule_test_id' })
        ]
      })
    });
    expect(result.currentVersionNumber).toBe(2);
  });

  it('archives a network policy even when linked to firewalls', async () => {
    mockDb.networkPolicy.update.mockResolvedValueOnce({
      oid: BigInt(1),
      id: 'npo_test',
      status: 'archived',
      firewallLinks: []
    });

    await networkPolicyService.archiveNetworkPolicy({
      tenant,
      environment,
      networkPolicy: {
        oid: BigInt(1),
        id: 'npo_test',
        status: 'active',
        tenantOid: tenant.oid,
        environmentOid: environment.oid
      } as any
    });

    expect(mockDb.firewallNetworkPolicy.count).not.toHaveBeenCalled();
    expect(mockDb.networkPolicy.update).toHaveBeenCalledWith({
      where: {
        oid: BigInt(1),
        tenantOid: tenant.oid,
        environmentOid: environment.oid
      },
      data: {
        status: 'archived',
        archivedAt: expect.any(Date)
      },
      include: expect.any(Object)
    });
    expect(networkPolicyDeletedQueue.add).toHaveBeenCalledWith({
      networkPolicyId: 'npo_test'
    });
  });
});

let baseRule = () => ({
  effect: 'allow' as const,
  direction: 'ingress' as const,
  cidrs: ['198.51.100.0/24'],
  enabled: true,
  priority: 10
});
