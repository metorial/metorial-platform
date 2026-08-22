import { beforeEach, describe, expect, it, vi } from 'vitest';

let { tx, globalDb, afterHooks, fabricFire } = vi.hoisted(() => {
  let makeModel = () => ({
    update: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn()
  });

  return {
    globalDb: {
      integrationProvider: makeModel(),
      integrationProviderVersion: makeModel(),
      integration: makeModel(),
      integrationVersion: makeModel(),
      integrationVersionProvider: makeModel(),
      integrationInstance: makeModel(),
      integrationInstanceProvider: makeModel(),
      integrationInstanceProviderVersion: makeModel()
    },
    tx: {
      integrationProvider: makeModel(),
      integrationProviderVersion: makeModel(),
      integration: makeModel(),
      integrationVersion: makeModel(),
      integrationVersionProvider: makeModel(),
      integrationInstance: makeModel(),
      integrationInstanceProvider: makeModel(),
      integrationInstanceProviderVersion: makeModel()
    },
    afterHooks: [] as (() => Promise<void>)[],
    fabricFire: vi.fn()
  };
});

vi.mock('@metorial-subspace/db', () => {
  return {
    db: globalDb,
    getId: (kind: string) => ({ id: `${kind}_1`, oid: 1n }),
    Prisma: {
      JsonNull: null
    },
    addAfterTransactionHook: vi.fn(async hook => {
      afterHooks.push(hook);
    }),
    withTransaction: async (cb: (db: any) => Promise<any>) => await cb(tx)
  };
});

vi.mock('@metorial/fabric', () => ({ Fabric: { fire: fabricFire } }));

vi.mock('../../../provider-internal/src/lib/toolFilter', () => ({
  normalizeToolFilters: (toolFilter: PrismaJson.ToolFilter | null) =>
    toolFilter ?? { type: 'v1.allow_all' }
}));

import {
  createIntegrationInstanceProviderVersion,
  createIntegrationProviderVersion,
  createIntegrationVersion,
  refreshIntegrationInstanceStatus
} from './versions';

describe('integration version helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    afterHooks.length = 0;
    tx.integrationProvider.updateMany.mockResolvedValue({ count: 1 });
    tx.integrationInstanceProvider.updateMany.mockResolvedValue({ count: 1 });
  });

  it('creates integration provider versions through the active transaction client', async () => {
    tx.integrationProvider.update.mockResolvedValue({
      oid: 10n,
      currentVersionIndex: 2
    });
    tx.integrationProviderVersion.create.mockResolvedValue({
      oid: 20n,
      id: 'integration_provider_version_1',
      index: 2
    });

    await createIntegrationProviderVersion({
      integrationProviderOid: 10n,
      status: 'active',
      deploymentOid: 30n,
      toolFilter: { type: 'v1.allow_all' }
    });

    expect(tx.integrationProvider.update).toHaveBeenCalled();
    expect(tx.integrationProviderVersion.create).toHaveBeenCalled();
    expect(tx.integrationProvider.updateMany).toHaveBeenCalled();
    expect(globalDb.integrationProvider.update).not.toHaveBeenCalled();
    expect(globalDb.integrationProviderVersion.create).not.toHaveBeenCalled();
    expect(afterHooks).toHaveLength(0);
  });

  it('fires update lifecycle events after a material provider version commits', async () => {
    tx.integrationProvider.findUnique.mockResolvedValue({
      currentVersion: {
        oid: 5n,
        id: 'integration_provider_version_old',
        status: 'active',
        deploymentOid: 6n,
        authMethodOid: null,
        authCredentialsOid: null,
        configOid: null,
        toolFilter: { type: 'v1.allow_all' }
      }
    });
    tx.integrationProvider.update.mockResolvedValue({
      oid: 10n,
      currentVersionIndex: 2
    });
    tx.integrationProviderVersion.create.mockResolvedValue({
      oid: 20n,
      id: 'integration_provider_version_new',
      index: 2
    });
    globalDb.integrationProvider.findUnique.mockResolvedValue({
      oid: 10n,
      id: 'integration_provider_1',
      status: 'active'
    });

    await createIntegrationProviderVersion({
      integrationProviderOid: 10n,
      status: 'active',
      deploymentOid: 30n,
      toolFilter: { type: 'v1.allow_all' }
    });
    expect(fabricFire).not.toHaveBeenCalled();

    await afterHooks[0]!();

    expect(fabricFire.mock.calls.map(call => call[0])).toEqual([
      'provider.integration_provider.updated:before',
      'provider.integration_provider.updated:after'
    ]);
  });

  it('creates integration versions through the active transaction client', async () => {
    tx.integration.update.mockResolvedValue({
      oid: 10n,
      currentVersionIndex: 3
    });
    tx.integrationVersion.create.mockResolvedValue({
      oid: 20n,
      index: 3
    });
    tx.integrationProvider.findMany.mockResolvedValue([{ currentVersionOid: 30n }]);

    await createIntegrationVersion({ integrationOid: 10n });

    expect(tx.integration.update).toHaveBeenCalled();
    expect(tx.integrationVersion.create).toHaveBeenCalled();
    expect(tx.integrationVersionProvider.createMany).toHaveBeenCalled();
    expect(tx.integration.updateMany).toHaveBeenCalled();
    expect(globalDb.integration.update).not.toHaveBeenCalled();
    expect(globalDb.integrationVersion.create).not.toHaveBeenCalled();
  });

  it('creates instance provider versions through the active transaction client', async () => {
    tx.integrationInstanceProvider.findUnique.mockResolvedValue(null);
    tx.integrationInstanceProviderVersion.create.mockResolvedValue({
      oid: 20n,
      id: 'integration_instance_provider_version_1'
    });

    await createIntegrationInstanceProviderVersion({
      integrationInstanceProviderOid: 10n,
      status: 'active',
      integrationProviderVersionOid: 30n,
      toolFilter: { type: 'v1.allow_all' }
    });

    expect(tx.integrationInstanceProviderVersion.create).toHaveBeenCalled();
    expect(tx.integrationInstanceProvider.updateMany).toHaveBeenCalled();
    expect(globalDb.integrationInstanceProviderVersion.create).not.toHaveBeenCalled();
    expect(globalDb.integrationInstanceProvider.updateMany).not.toHaveBeenCalled();
  });

  it('fires one after-commit event for the first configured instance provider version', async () => {
    tx.integrationInstanceProvider.findUnique.mockResolvedValue(null);
    tx.integrationInstanceProviderVersion.create.mockResolvedValue({
      oid: 20n,
      id: 'integration_instance_provider_version_1'
    });
    globalDb.integrationInstanceProvider.findUnique.mockResolvedValue({
      id: 'integration_instance_provider_1',
      integrationInstance: { id: 'integration_instance_1' },
      integrationProvider: { id: 'integration_provider_1' }
    });

    await createIntegrationInstanceProviderVersion({
      integrationInstanceProviderOid: 10n,
      status: 'active',
      integrationProviderVersionOid: 30n,
      toolFilter: { type: 'v1.allow_all' }
    });
    expect(fabricFire).not.toHaveBeenCalled();

    await afterHooks[0]!();

    expect(fabricFire).toHaveBeenCalledWith(
      'provider.integration_instance_provider.version_changed:after',
      {
        integrationInstanceProviderId: 'integration_instance_provider_1',
        integrationInstanceId: 'integration_instance_1',
        integrationProviderId: 'integration_provider_1',
        fromVersionId: null,
        toVersionId: 'integration_instance_provider_version_1'
      }
    );
  });

  it('does not create a duplicate instance provider version when current material matches', async () => {
    let currentVersion = {
      oid: 20n,
      status: 'active',
      integrationProviderVersionOid: 30n,
      configOid: 40n,
      authConfigOid: null,
      toolFilter: { type: 'v1.allow_all' },
      isOverrideToolFilter: false
    };
    tx.integrationInstanceProvider.findUnique.mockResolvedValue({
      currentVersion
    });

    let version = await createIntegrationInstanceProviderVersion({
      integrationInstanceProviderOid: 10n,
      status: 'active',
      integrationProviderVersionOid: 30n,
      configOid: 40n,
      authConfigOid: null,
      toolFilter: { type: 'v1.allow_all' },
      isOverrideToolFilter: false
    });

    expect(version).toBe(currentVersion);
    expect(tx.integrationInstanceProviderVersion.create).not.toHaveBeenCalled();
    expect(tx.integrationInstanceProvider.updateMany).not.toHaveBeenCalled();
    expect(afterHooks).toHaveLength(0);
  });

  it('compares instance provider version tool filters canonically', async () => {
    let currentVersion = {
      oid: 20n,
      status: 'active',
      integrationProviderVersionOid: 30n,
      configOid: null,
      authConfigOid: null,
      toolFilter: {
        type: 'v1.filter',
        filters: [{ keys: ['tool-a'], type: 'tool_keys' }]
      },
      isOverrideToolFilter: false
    };
    tx.integrationInstanceProvider.findUnique.mockResolvedValue({
      currentVersion
    });

    let version = await createIntegrationInstanceProviderVersion({
      integrationInstanceProviderOid: 10n,
      status: 'active',
      integrationProviderVersionOid: 30n,
      toolFilter: {
        filters: [{ type: 'tool_keys', keys: ['tool-a'] }],
        type: 'v1.filter'
      } as PrismaJson.ToolFilter
    });

    expect(version).toBe(currentVersion);
    expect(tx.integrationInstanceProviderVersion.create).not.toHaveBeenCalled();
    expect(tx.integrationInstanceProvider.updateMany).not.toHaveBeenCalled();
  });

  it('refreshes integration instance status through the active transaction client', async () => {
    tx.integrationInstance.findUnique.mockResolvedValue({
      oid: 10n,
      integrationOid: 20n,
      status: 'draft'
    });
    tx.integrationProvider.count.mockResolvedValue(1);
    tx.integrationInstanceProvider.count.mockResolvedValue(1);
    tx.integrationInstance.update.mockResolvedValue({ oid: 10n, status: 'active' });

    await refreshIntegrationInstanceStatus({ integrationInstanceOid: 10n });

    expect(tx.integrationInstance.findUnique).toHaveBeenCalled();
    expect(tx.integrationProvider.count).toHaveBeenCalled();
    expect(tx.integrationInstanceProvider.count).toHaveBeenCalled();
    expect(tx.integrationInstance.update).toHaveBeenCalled();
    expect(globalDb.integrationInstanceProvider.count).not.toHaveBeenCalled();
  });
});
