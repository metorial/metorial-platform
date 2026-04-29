import { db } from '@metorial-subspace/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshIntegrationInstanceStatus } from '../src/lib/versions';

vi.mock('@metorial-subspace/db', () => ({
  db: {
    integrationInstance: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    integrationProvider: {
      count: vi.fn()
    },
    integrationInstanceProvider: {
      count: vi.fn(),
      updateMany: vi.fn()
    },
    integrationInstanceProviderVersion: {
      create: vi.fn()
    }
  },
  getId: vi.fn(() => ({ oid: 100n, id: 'iiv_test' })),
  withTransaction: async (fn: () => unknown) => await fn()
}));

let mockedDb = db as unknown as {
  integrationInstance: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  integrationProvider: {
    count: ReturnType<typeof vi.fn>;
  };
  integrationInstanceProvider: {
    count: ReturnType<typeof vi.fn>;
  };
};

describe('integration instance versioning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps a draft instance in draft until every active provider is set', async () => {
    let draft = { oid: 1n, integrationOid: 2n, status: 'draft' };
    mockedDb.integrationInstance.findUnique.mockResolvedValue(draft);
    mockedDb.integrationProvider.count.mockResolvedValue(2);
    mockedDb.integrationInstanceProvider.count.mockResolvedValue(1);

    let result = await refreshIntegrationInstanceStatus({ integrationInstanceOid: 1n });

    expect(result).toBe(draft);
    expect(mockedDb.integrationInstance.update).not.toHaveBeenCalled();
  });

  it('promotes a draft instance once all active providers are set', async () => {
    let draft = { oid: 1n, integrationOid: 2n, status: 'draft' };
    let active = { ...draft, status: 'active' };
    mockedDb.integrationInstance.findUnique.mockResolvedValue(draft);
    mockedDb.integrationProvider.count.mockResolvedValue(2);
    mockedDb.integrationInstanceProvider.count.mockResolvedValue(2);
    mockedDb.integrationInstance.update.mockResolvedValue(active);

    let result = await refreshIntegrationInstanceStatus({ integrationInstanceOid: 1n });

    expect(result).toBe(active);
    expect(mockedDb.integrationInstance.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { status: 'active' }
    });
  });

  it('does not change instances that are no longer drafts', async () => {
    let active = { oid: 1n, integrationOid: 2n, status: 'active' };
    mockedDb.integrationInstance.findUnique.mockResolvedValue(active);

    let result = await refreshIntegrationInstanceStatus({ integrationInstanceOid: 1n });

    expect(result).toBe(active);
    expect(mockedDb.integrationProvider.count).not.toHaveBeenCalled();
    expect(mockedDb.integrationInstance.update).not.toHaveBeenCalled();
  });
});
