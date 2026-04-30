import { db } from '@metorial-subspace/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runIntegrationInstanceArchivedEffects } from '../src/queues/lifecycle/integrationInstance';

let {
  syncIntegrationInstanceProviderCredentials,
  indexIntegrationInstanceAdd,
  integrationInstanceProviderSetAddMany,
  identityDeletedAddMany
} = vi.hoisted(() => ({
  syncIntegrationInstanceProviderCredentials: vi.fn(),
  indexIntegrationInstanceAdd: vi.fn(),
  integrationInstanceProviderSetAddMany: vi.fn(),
  identityDeletedAddMany: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    integrationInstanceProvider: {
      findMany: vi.fn(),
      updateMany: vi.fn()
    },
    identity: {
      findMany: vi.fn(),
      updateMany: vi.fn()
    }
  }
}));

vi.mock('@metorial-subspace/module-identity', () => ({
  identityInternalService: {
    syncIntegrationInstanceProviderCredentials
  }
}));

vi.mock('@metorial-subspace/module-identity/src/queues/lifecycle/identity', () => ({
  identityDeletedQueue: {
    addMany: identityDeletedAddMany
  }
}));

vi.mock('@lowerdeck/queue', () => ({
  createQueue: vi.fn(() => ({
    process: (handler: unknown) => handler
  }))
}));

vi.mock('../src/env', () => ({
  env: {
    service: {
      REDIS_URL: 'redis://example'
    }
  }
}));

vi.mock('../src/queues/search/integrationInstance', () => ({
  indexIntegrationInstanceQueue: {
    add: indexIntegrationInstanceAdd
  }
}));

vi.mock('../src/queues/lifecycle/integrationInstanceProvider', () => ({
  integrationInstanceProviderSetQueue: {
    addMany: integrationInstanceProviderSetAddMany
  }
}));

let mockedDb = db as unknown as {
  integrationInstanceProvider: {
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  identity: {
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
};

describe('integration instance archived effects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('archives active instance providers through their lifecycle queue', async () => {
    mockedDb.integrationInstanceProvider.findMany.mockResolvedValue([
      { id: 'iip_1' },
      { id: 'iip_2' }
    ]);
    mockedDb.identity.findMany.mockResolvedValue([]);

    let archivedAt = new Date('2026-04-30T07:00:00.000Z');

    await runIntegrationInstanceArchivedEffects({
      integrationInstanceId: 'ii_1',
      integrationInstanceOid: 1n,
      archivedAt
    });

    expect(mockedDb.integrationInstanceProvider.updateMany).toHaveBeenCalledWith({
      where: { integrationInstanceOid: 1n, status: 'active' },
      data: { status: 'archived', archivedAt }
    });
    expect(integrationInstanceProviderSetAddMany).toHaveBeenCalledWith([
      {
        integrationInstanceId: 'ii_1',
        integrationInstanceProviderId: 'iip_1'
      },
      {
        integrationInstanceId: 'ii_1',
        integrationInstanceProviderId: 'iip_2'
      }
    ]);
    expect(indexIntegrationInstanceAdd).toHaveBeenCalledWith({
      integrationInstanceId: 'ii_1'
    });
    expect(syncIntegrationInstanceProviderCredentials).toHaveBeenCalledWith({
      integrationInstanceProviderIds: ['iip_1', 'iip_2']
    });
    expect(identityDeletedAddMany).not.toHaveBeenCalled();
  });
});
