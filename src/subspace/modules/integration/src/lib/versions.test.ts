import { beforeEach, describe, expect, it, vi } from 'vitest';

let { tx, globalDb } = vi.hoisted(() => {
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
    }
  };
});

vi.mock('@metorial-subspace/db', () => {
  return {
    db: globalDb,
    getId: (kind: string) => ({ id: `${kind}_1`, oid: 1n }),
    Prisma: {
      JsonNull: null
    },
    withTransaction: async (cb: (db: any) => Promise<any>) => await cb(tx)
  };
});

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
  });

  it('creates integration provider versions through the active transaction client', async () => {
    tx.integrationProvider.update.mockResolvedValue({
      oid: 10n,
      currentVersionIndex: 2
    });
    tx.integrationProviderVersion.create.mockResolvedValue({
      oid: 20n,
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
    tx.integrationInstanceProviderVersion.create.mockResolvedValue({
      oid: 20n
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
