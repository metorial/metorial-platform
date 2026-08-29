import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  tenantFindUnique: vi.fn(),
  tenantUpsert: vi.fn(),
  tenantFindFirst: vi.fn(),
  tenantFindFirstOrThrow: vi.fn(),
  environmentFindMany: vi.fn(),
  environmentCreateMany: vi.fn(),
  environmentUpdateMany: vi.fn(),
  solutionFindMany: vi.fn(),
  linkTenantToProjectMirror: vi.fn(),
  linkEnvironmentToInstanceMirror: vi.fn(),
  ensureNetworkForEnvironment: vi.fn(),
  reconcileMonitorAddManyWithOps: vi.fn(),
  reconcileBackingsAddManyWithOps: vi.fn(),
  retentionAdd: vi.fn(),
  retentionDowngradeAdd: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/error', () => ({
  ServiceError: class ServiceError extends Error {},
  notFoundError: (resource: string) => ({ resource })
}));

vi.mock('@lowerdeck/id', () => ({
  generatePlainId: () => 'URLKEY1234'
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    tenant: {
      findUnique: mocks.tenantFindUnique,
      upsert: mocks.tenantUpsert,
      findFirst: mocks.tenantFindFirst,
      findFirstOrThrow: mocks.tenantFindFirstOrThrow
    },
    environment: {
      findMany: mocks.environmentFindMany,
      createMany: mocks.environmentCreateMany,
      updateMany: mocks.environmentUpdateMany
    },
    solution: { findMany: mocks.solutionFindMany }
  },
  getId: (model: string) => ({ oid: 1n, id: `${model}_1` })
}));

vi.mock('@metorial-subspace/module-auth/src/queues/reconcile', () => ({
  reconcileTenantManagedBackingsQueue: {
    addManyWithOps: mocks.reconcileBackingsAddManyWithOps
  }
}));

vi.mock(
  '@metorial-subspace/module-deployment/src/queues/reconcile/providerDeploymentMonitor',
  () => ({
    reconcileProviderDeploymentMonitorForEnvironmentQueue: {
      addManyWithOps: mocks.reconcileMonitorAddManyWithOps
    }
  })
);

vi.mock('@metorial-subspace/module-enclave', () => ({
  networkInternalService: {
    ensureNetworkForEnvironment: mocks.ensureNetworkForEnvironment
  }
}));

vi.mock('../lib/mirrorRecords', () => ({
  linkTenantToProjectMirror: mocks.linkTenantToProjectMirror,
  linkEnvironmentToInstanceMirror: mocks.linkEnvironmentToInstanceMirror
}));

vi.mock('../queues/retention/sync', () => ({
  tenantLogRetentionSyncQueue: { add: mocks.retentionAdd }
}));

vi.mock('../queues/retention/downgradeSync', () => ({
  tenantSessionRetentionDowngradeSyncQueue: { add: mocks.retentionDowngradeAdd }
}));

import { tenantService } from './tenant';

let tenant = { oid: 20n, id: 'ktn_20', identifier: 'mte-pro-2', projectOid: null };
let environment = {
  oid: 30n,
  id: 'ken_30',
  tenantOid: 20n,
  identifier: 'mte-ins-3',
  instanceOid: null
};

let input = {
  name: 'Project',
  identifier: 'mte-pro-2',
  resourceTenantId: 'rtn_100',
  resourceTenantIdentifier: 'mte-pro-2',
  projectOid: 2n,
  skipNetworks: true,
  environments: [
    {
      name: 'Production',
      identifier: 'mte-ins-3',
      type: 'production' as const,
      resourceGroupId: 'rgr_200',
      resourceGroupIdentifier: 'mte-ins-3',
      instanceOid: 3n
    }
  ]
};

describe('tenantService.upsertTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantFindUnique.mockResolvedValue({ id: tenant.id, logRetentionInDays: 30 });
    mocks.tenantUpsert.mockResolvedValue(tenant);
    mocks.tenantFindFirstOrThrow.mockResolvedValue(tenant);
    mocks.environmentFindMany.mockResolvedValue([environment]);
    mocks.environmentCreateMany.mockResolvedValue({ count: 0 });
    mocks.environmentUpdateMany.mockResolvedValue({ count: 1 });
    mocks.solutionFindMany.mockResolvedValue([]);
  });

  it('never writes mirror references that have no mirror record behind them', async () => {
    await tenantService.upsertTenant({ input });

    expect(mocks.tenantUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.not.objectContaining({ projectOid: expect.anything() }),
        create: expect.not.objectContaining({ projectOid: expect.anything() })
      })
    );
    expect(mocks.environmentCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.not.objectContaining({ instanceOid: expect.anything() })]
      })
    );
    expect(mocks.environmentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ instanceOid: expect.anything() })
      })
    );
  });

  it('links the tenant and its environments to their mirror records', async () => {
    await tenantService.upsertTenant({ input });

    expect(mocks.linkTenantToProjectMirror).toHaveBeenCalledWith({
      tenant,
      projectOid: 2n
    });
    expect(mocks.linkEnvironmentToInstanceMirror).toHaveBeenCalledWith({
      environment,
      instanceOid: 3n
    });
    expect(mocks.linkTenantToProjectMirror.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.linkEnvironmentToInstanceMirror.mock.invocationCallOrder[0]!
    );
  });

  it('leaves environments without an instance alone', async () => {
    await tenantService.upsertTenant({
      input: {
        ...input,
        projectOid: undefined,
        environments: [{ ...input.environments[0]!, instanceOid: undefined }]
      }
    });

    expect(mocks.linkTenantToProjectMirror).not.toHaveBeenCalled();
    expect(mocks.linkEnvironmentToInstanceMirror).not.toHaveBeenCalled();
  });

  it('still links mirror oids when the tenant row already exists', async () => {
    mocks.tenantUpsert.mockRejectedValue({ code: 'P2002' });
    mocks.tenantFindFirst.mockResolvedValue({ ...tenant });
    mocks.linkTenantToProjectMirror.mockResolvedValue(2n);

    let result = await tenantService.upsertTenant({ input });

    expect(mocks.linkTenantToProjectMirror).toHaveBeenCalledWith({
      tenant: expect.objectContaining({ oid: tenant.oid }),
      projectOid: 2n
    });
    expect(mocks.linkEnvironmentToInstanceMirror).toHaveBeenCalledWith({
      environment,
      instanceOid: 3n
    });
    expect(result.projectOid).toBe(2n);
  });
});

describe('tenantService.upsertTenant retention downgrade sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantFindFirstOrThrow.mockResolvedValue(tenant);
    mocks.environmentFindMany.mockResolvedValue([environment]);
    mocks.environmentCreateMany.mockResolvedValue({ count: 0 });
    mocks.environmentUpdateMany.mockResolvedValue({ count: 1 });
    mocks.solutionFindMany.mockResolvedValue([]);
  });

  it('enqueues a downgrade sync when the retention level gets stricter', async () => {
    mocks.tenantFindUnique.mockResolvedValue({
      id: tenant.id,
      logRetentionInDays: 30,
      dataRetentionLevel: 'full',
      collectErrors: true,
      storeToolCallAttachments: true
    });
    mocks.tenantUpsert.mockResolvedValue({
      ...tenant,
      dataRetentionLevel: 'none',
      collectErrors: true,
      storeToolCallAttachments: true
    });

    await tenantService.upsertTenant({ input: { ...input, dataRetentionLevel: 'none' } });

    expect(mocks.retentionDowngradeAdd).toHaveBeenCalledWith(
      { tenantId: tenant.id },
      { id: `tenant-session-retention-downgrade-sync:${tenant.id}` }
    );
  });

  it('does not enqueue a downgrade sync when the retention level gets looser', async () => {
    mocks.tenantFindUnique.mockResolvedValue({
      id: tenant.id,
      logRetentionInDays: 30,
      dataRetentionLevel: 'none',
      collectErrors: true,
      storeToolCallAttachments: true
    });
    mocks.tenantUpsert.mockResolvedValue({
      ...tenant,
      dataRetentionLevel: 'full',
      collectErrors: true,
      storeToolCallAttachments: true
    });

    await tenantService.upsertTenant({ input: { ...input, dataRetentionLevel: 'full' } });

    expect(mocks.retentionDowngradeAdd).not.toHaveBeenCalled();
  });

  it('enqueues a downgrade sync when collectErrors is turned off', async () => {
    mocks.tenantFindUnique.mockResolvedValue({
      id: tenant.id,
      logRetentionInDays: 30,
      dataRetentionLevel: 'full',
      collectErrors: true,
      storeToolCallAttachments: true
    });
    mocks.tenantUpsert.mockResolvedValue({
      ...tenant,
      dataRetentionLevel: 'full',
      collectErrors: false,
      storeToolCallAttachments: true
    });

    await tenantService.upsertTenant({ input: { ...input, collectErrors: false } });

    expect(mocks.retentionDowngradeAdd).toHaveBeenCalled();
  });

  it('enqueues a downgrade sync when storeToolCallAttachments is turned off', async () => {
    mocks.tenantFindUnique.mockResolvedValue({
      id: tenant.id,
      logRetentionInDays: 30,
      dataRetentionLevel: 'full',
      collectErrors: true,
      storeToolCallAttachments: true
    });
    mocks.tenantUpsert.mockResolvedValue({
      ...tenant,
      dataRetentionLevel: 'full',
      collectErrors: true,
      storeToolCallAttachments: false
    });

    await tenantService.upsertTenant({ input: { ...input, storeToolCallAttachments: false } });

    expect(mocks.retentionDowngradeAdd).toHaveBeenCalled();
  });

  it('does not enqueue a downgrade sync for a brand-new tenant', async () => {
    mocks.tenantFindUnique.mockResolvedValue(null);
    mocks.tenantUpsert.mockResolvedValue({
      ...tenant,
      dataRetentionLevel: 'none',
      collectErrors: true,
      storeToolCallAttachments: true
    });

    await tenantService.upsertTenant({ input: { ...input, dataRetentionLevel: 'none' } });

    expect(mocks.retentionDowngradeAdd).not.toHaveBeenCalled();
  });
});
