import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, tx } = vi.hoisted(() => ({
  db: {
    integrationInstanceProvider: { findMany: vi.fn() },
    integrationInstanceGroupSource: { findMany: vi.fn() },
    integrationInstanceGroupProvider: { findMany: vi.fn() },
    integrationInstanceGroup: { findUnique: vi.fn() }
  },
  tx: {
    integrationInstanceGroupSource: { upsert: vi.fn() },
    integrationInstanceGroupProvider: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn()
    },
    integrationInstanceGroup: { update: vi.fn() }
  }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  addAfterTransactionHook: vi.fn(),
  db,
  getId: (kind: string) => ({ id: `${kind}_new`, oid: 1n }),
  Prisma: {
    JsonNull: 'JSON_NULL'
  },
  withTransaction: async (cb: (db: any) => Promise<any>) => await cb(tx)
}));

vi.mock('@metorial-subspace/list-utils', () => ({
  checkDeletedEdit: vi.fn(),
  checkDeletedRelation: vi.fn(),
  normalizeDateFilter: vi.fn(),
  normalizeStatusForGet: vi.fn(),
  normalizeStatusForList: vi.fn(),
  resolveIntegrationInstanceProviders: vi.fn(),
  resolveIntegrationInstances: vi.fn(),
  resolveIntegrationProviders: vi.fn(),
  resolveIntegrations: vi.fn(),
  resolveProviderAuthConfigs: vi.fn(),
  resolveProviderConfigs: vi.fn(),
  resolveProviderDeployments: vi.fn(),
  resolveProviders: vi.fn(),
  resolveSessionTemplates: vi.fn()
}));

vi.mock('@metorial-subspace/module-provider-internal', () => ({
  normalizeToolFilters: (input?: PrismaJson.ToolFilter | null) => {
    if (!input) return { type: 'v1.allow_all' };
    return input;
  }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  getMetorialSolution: vi.fn(async () => ({ oid: 2 })),
  resolveMetorialFacing: vi.fn()
}));

vi.mock('../queues/lifecycle/integrationInstanceGroupProvider', () => ({
  enqueueIntegrationInstanceGroupProviderSet: vi.fn(),
  enqueueIntegrationInstanceGroupProvidersSet: vi.fn()
}));

vi.mock('./integrationInstanceGroup', () => ({
  integrationInstanceGroupProviderInclude: {}
}));

import {
  integrationInstanceGroupProviderService,
  resolveIntegrationInstanceGroupProviderToolFilterInput
} from './integrationInstanceGroupProvider';

let existingFilter: PrismaJson.ToolFilter = {
  type: 'v1.filter',
  filters: [{ type: 'tool_keys', keys: ['old'] }]
};

let replacementFilter: PrismaJson.ToolFilter = {
  type: 'v1.filter',
  ignoreParentFilters: true,
  filters: [{ type: 'tool_keys', keys: ['new'] }]
};

describe('resolveIntegrationInstanceGroupProviderToolFilterInput', () => {
  it('preserves existing filters and override state when input omits toolFilters', () => {
    expect(
      resolveIntegrationInstanceGroupProviderToolFilterInput({
        inputToolFilters: undefined,
        existingToolFilter: existingFilter,
        existingIsOverrideToolFilter: true
      })
    ).toEqual({
      toolFilter: existingFilter,
      isOverrideToolFilter: true
    });
  });

  it('treats explicit null as clearing the group layer to inherit parent filters', () => {
    expect(
      resolveIntegrationInstanceGroupProviderToolFilterInput({
        inputToolFilters: null,
        existingToolFilter: existingFilter,
        existingIsOverrideToolFilter: true
      })
    ).toEqual({
      toolFilter: null,
      isOverrideToolFilter: false
    });
  });

  it('uses concrete filters as replacements and strips control fields from storage', () => {
    expect(
      resolveIntegrationInstanceGroupProviderToolFilterInput({
        inputToolFilters: replacementFilter,
        existingToolFilter: existingFilter,
        existingIsOverrideToolFilter: false
      })
    ).toEqual({
      toolFilter: {
        type: 'v1.filter',
        filters: [{ type: 'tool_keys', keys: ['new'] }]
      },
      isOverrideToolFilter: true
    });
  });
});

let sourceProvider = {
  oid: 70n,
  id: 'iip_1',
  name: 'Provider',
  description: null,
  metadata: null,
  privateMetadata: null,
  integrationOid: 10n,
  integrationInstanceOid: 20n,
  integrationProviderOid: 30n,
  currentVersion: { configOid: 40n }
};

let integrationInstanceGroup = { oid: 50n, id: 'iig_1', isMagicMcpBacking: false } as any;

let runSetProviders = async (d: { tenant: any; environment: any }) =>
  await integrationInstanceGroupProviderService.setIntegrationInstanceGroupProvidersInternal({
    tenant: d.tenant,
    environment: d.environment,
    integrationInstanceGroup,
    input: [{ integrationInstanceProviderId: sourceProvider.id }]
  });

describe('integrationInstanceGroupProviderService.setIntegrationInstanceGroupProvidersInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    db.integrationInstanceProvider.findMany.mockResolvedValue([sourceProvider]);
    db.integrationInstanceGroupSource.findMany.mockResolvedValue([]);
    db.integrationInstanceGroupProvider.findMany.mockResolvedValue([]);
    tx.integrationInstanceGroupSource.upsert.mockResolvedValue({ oid: 60n });
    tx.integrationInstanceGroupProvider.upsert.mockResolvedValue({ oid: 80n });
    tx.integrationInstanceGroupProvider.findMany.mockResolvedValue([
      { oid: 80n, id: 'iigp_1' }
    ]);
  });

  it('mirrors the project and instance onto both the source and the group provider', async () => {
    await runSetProviders({
      tenant: { oid: 1n, projectOid: 11n },
      environment: { oid: 3n, instanceOid: 33n }
    });

    expect(tx.integrationInstanceGroupSource.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantOid: 1n,
          projectOid: 11n,
          solutionOid: 2,
          environmentOid: 3n,
          instanceOid: 33n
        })
      })
    );
    expect(tx.integrationInstanceGroupProvider.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantOid: 1n,
          projectOid: 11n,
          solutionOid: 2,
          environmentOid: 3n,
          instanceOid: 33n
        })
      })
    );
  });

  it('writes null mirrors for an unlinked tenant and environment', async () => {
    await runSetProviders({
      tenant: { oid: 1n, projectOid: null },
      environment: { oid: 3n, instanceOid: null }
    });

    expect(tx.integrationInstanceGroupSource.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantOid: 1n,
          projectOid: null,
          environmentOid: 3n,
          instanceOid: null
        })
      })
    );
    expect(tx.integrationInstanceGroupProvider.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantOid: 1n,
          projectOid: null,
          environmentOid: 3n,
          instanceOid: null
        })
      })
    );
  });

  it('leaves the update branch of both upserts free of the mirrored references', async () => {
    await runSetProviders({
      tenant: { oid: 1n, projectOid: 11n },
      environment: { oid: 3n, instanceOid: 33n }
    });

    let sourceUpdate = tx.integrationInstanceGroupSource.upsert.mock.calls[0]![0].update;
    let providerUpdate = tx.integrationInstanceGroupProvider.upsert.mock.calls[0]![0].update;

    expect(sourceUpdate).not.toHaveProperty('projectOid');
    expect(sourceUpdate).not.toHaveProperty('instanceOid');
    expect(providerUpdate).not.toHaveProperty('projectOid');
    expect(providerUpdate).not.toHaveProperty('instanceOid');
  });

  it('upserts by integration provider and replaces its source provider', async () => {
    db.integrationInstanceGroupProvider.findMany.mockResolvedValue([
      {
        integrationProviderOid: sourceProvider.integrationProviderOid,
        integrationInstanceProviderOid: 69n,
        toolFilter: existingFilter,
        isOverrideToolFilter: true
      }
    ]);

    await runSetProviders({
      tenant: { oid: 1n, projectOid: 11n },
      environment: { oid: 3n, instanceOid: 33n }
    });

    expect(db.integrationInstanceGroupProvider.findMany).toHaveBeenCalledWith({
      where: {
        integrationInstanceGroupOid: integrationInstanceGroup.oid,
        integrationProviderOid: { in: [sourceProvider.integrationProviderOid] }
      }
    });
    expect(tx.integrationInstanceGroupProvider.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          integrationInstanceGroupOid_integrationProviderOid: {
            integrationInstanceGroupOid: integrationInstanceGroup.oid,
            integrationProviderOid: sourceProvider.integrationProviderOid
          }
        },
        update: expect.objectContaining({
          integrationInstanceProviderOid: sourceProvider.oid,
          toolFilter: existingFilter,
          isOverrideToolFilter: true
        })
      })
    );
  });

  let liveSource = {
    oid: 60n,
    integrationInstanceOid: sourceProvider.integrationInstanceOid,
    status: 'active',
    archivedAt: null,
    isParentDeleted: false
  };

  let liveGroupProvider = {
    oid: 80n,
    id: 'iigp_1',
    status: 'active',
    archivedAt: null,
    isParentDeleted: false,
    name: sourceProvider.name,
    description: sourceProvider.description,
    metadata: sourceProvider.metadata,
    privateMetadata: sourceProvider.privateMetadata,
    integrationInstanceGroupSourceOid: liveSource.oid,
    integrationOid: sourceProvider.integrationOid,
    integrationInstanceOid: sourceProvider.integrationInstanceOid,
    integrationInstanceProviderOid: sourceProvider.oid,
    integrationProviderOid: sourceProvider.integrationProviderOid,
    toolFilter: null,
    isOverrideToolFilter: false
  };

  it('skips writes when the source, group provider and group are already up to date', async () => {
    db.integrationInstanceGroupSource.findMany.mockResolvedValue([liveSource]);
    db.integrationInstanceGroupProvider.findMany.mockResolvedValue([liveGroupProvider]);

    await integrationInstanceGroupProviderService.setIntegrationInstanceGroupProvidersInternal(
      {
        tenant: { oid: 1n, projectOid: 11n } as any,
        environment: { oid: 3n, instanceOid: 33n } as any,
        integrationInstanceGroup: { ...integrationInstanceGroup, status: 'active' },
        input: [{ integrationInstanceProviderId: sourceProvider.id }]
      }
    );

    expect(tx.integrationInstanceGroupSource.upsert).not.toHaveBeenCalled();
    expect(tx.integrationInstanceGroupProvider.upsert).not.toHaveBeenCalled();
    expect(tx.integrationInstanceGroup.update).not.toHaveBeenCalled();
    expect(tx.integrationInstanceGroupProvider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { oid: { in: [liveGroupProvider.oid] } } })
    );
  });

  it('rewrites a group provider whose fields drifted from its source provider', async () => {
    db.integrationInstanceGroupSource.findMany.mockResolvedValue([liveSource]);
    db.integrationInstanceGroupProvider.findMany.mockResolvedValue([
      { ...liveGroupProvider, name: 'Old name' }
    ]);

    await runSetProviders({
      tenant: { oid: 1n, projectOid: 11n },
      environment: { oid: 3n, instanceOid: 33n }
    });

    expect(tx.integrationInstanceGroupSource.upsert).not.toHaveBeenCalled();
    expect(tx.integrationInstanceGroupProvider.upsert).toHaveBeenCalledTimes(1);
  });

  it('rewrites an archived group provider even when its fields match', async () => {
    db.integrationInstanceGroupSource.findMany.mockResolvedValue([liveSource]);
    db.integrationInstanceGroupProvider.findMany.mockResolvedValue([
      { ...liveGroupProvider, status: 'archived', archivedAt: new Date() }
    ]);

    await runSetProviders({
      tenant: { oid: 1n, projectOid: 11n },
      environment: { oid: 3n, instanceOid: 33n }
    });

    expect(tx.integrationInstanceGroupProvider.upsert).toHaveBeenCalledTimes(1);
  });
});

describe('integrationInstanceGroupProviderService.syncMagicMcpIntegrationInstanceGroupProvidersInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    db.integrationInstanceProvider.findMany.mockResolvedValue([sourceProvider]);
    db.integrationInstanceGroupSource.findMany.mockResolvedValue([]);
    db.integrationInstanceGroupProvider.findMany.mockResolvedValue([]);
    tx.integrationInstanceGroupSource.upsert.mockResolvedValue({ oid: 60n });
    tx.integrationInstanceGroupProvider.upsert.mockResolvedValue({
      oid: 80n,
      integrationInstanceProviderOid: sourceProvider.oid
    });
  });

  it('archives stale providers without reloading the full provider tree', async () => {
    let providers =
      await integrationInstanceGroupProviderService.syncMagicMcpIntegrationInstanceGroupProvidersInternal(
        {
          tenant: { oid: 1n, projectOid: 11n } as any,
          environment: { oid: 3n, instanceOid: 33n } as any,
          integrationInstanceGroup: { ...integrationInstanceGroup, isMagicMcpBacking: true },
          input: [{ integrationInstanceProviderId: sourceProvider.id }]
        }
      );

    expect(providers).toEqual([
      { oid: 80n, integrationInstanceProviderOid: sourceProvider.oid }
    ]);
    expect(tx.integrationInstanceGroupProvider.findMany).not.toHaveBeenCalled();
    expect(tx.integrationInstanceGroupProvider.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          integrationInstanceProviderOid: { notIn: [sourceProvider.oid] }
        })
      })
    );
  });
});
