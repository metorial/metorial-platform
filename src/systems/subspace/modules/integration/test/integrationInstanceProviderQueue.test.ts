import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  processors,
  db,
  createQueueMock,
  providerConfigArchiveMock,
  providerAuthConfigArchiveMock,
  identityCredentialSyncMock,
  indexIntegrationInstanceQueueAddMock,
  syncIntegrationInstanceSessionTemplatesQueueAddMock,
  syncIntegrationInstanceGroupSessionTemplatesQueueAddMock
} = vi.hoisted(() => {
  let processors = new Map<string, (data: any) => Promise<void>>();
  let db = {
    integrationInstanceProvider: {
      findUnique: vi.fn()
    },
    integrationInstanceProviderVersion: {
      findMany: vi.fn()
    },
    integrationInstanceGroupProvider: {
      findMany: vi.fn(),
      updateMany: vi.fn()
    }
  };

  return {
    processors,
    db,
    createQueueMock: vi.fn((config: { name: string }) => ({
      add: vi.fn(),
      addMany: vi.fn(),
      process: vi.fn((handler: (data: any) => Promise<void>) => {
        processors.set(config.name, handler);
        return { name: config.name };
      })
    })),
    providerConfigArchiveMock: vi.fn(),
    providerAuthConfigArchiveMock: vi.fn(),
    identityCredentialSyncMock: vi.fn(),
    indexIntegrationInstanceQueueAddMock: vi.fn(),
    syncIntegrationInstanceSessionTemplatesQueueAddMock: vi.fn(),
    syncIntegrationInstanceGroupSessionTemplatesQueueAddMock: vi.fn()
  };
});

vi.mock('@lowerdeck/queue', () => ({
  createQueue: createQueueMock
}));

vi.mock('@metorial-subspace/db', () => ({
  db
}));

vi.mock('@metorial-subspace/module-auth', () => ({
  providerAuthConfigService: {
    archiveProviderAuthConfig: providerAuthConfigArchiveMock
  }
}));

vi.mock('@metorial-subspace/module-deployment', () => ({
  providerConfigService: {
    archiveProviderConfig: providerConfigArchiveMock
  }
}));

vi.mock('@metorial-subspace/module-identity', () => ({
  identityInternalService: {
    syncIntegrationInstanceProviderCredential: identityCredentialSyncMock
  }
}));

vi.mock(
  '@metorial-subspace/module-session/src/queues/lifecycle/linkedSessionTemplate',
  () => ({
    syncIntegrationInstanceSessionTemplatesQueue: {
      add: syncIntegrationInstanceSessionTemplatesQueueAddMock
    }
  })
);

vi.mock(
  '@metorial-subspace/module-session/src/queues/lifecycle/linkedIntegrationInstanceGroupTemplate',
  () => ({
    syncIntegrationInstanceGroupSessionTemplatesQueue: {
      addMany: syncIntegrationInstanceGroupSessionTemplatesQueueAddMock
    }
  })
);

vi.mock('../src/env', () => ({
  env: {
    service: {
      REDIS_URL: 'redis://test'
    }
  }
}));

vi.mock('../src/queues/search/integrationInstance', () => ({
  indexIntegrationInstanceQueue: {
    add: indexIntegrationInstanceQueueAddMock,
    addMany: vi.fn()
  }
}));

import '../src/queues/lifecycle/integrationInstanceProvider';

describe('integration instance provider lifecycle queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('archives only provider resources owned by the archived instance provider', async () => {
    let integrationInstanceProvider = {
      id: 'iip_1',
      oid: 10n,
      status: 'archived',
      integrationInstanceOid: 20n,
      tenant: { oid: 1n },
      solution: { oid: 2n },
      environment: { oid: 3n }
    };
    let sharedConfig = {
      id: 'pcf_shared',
      oid: 30n,
      status: 'active',
      owningIntegrationInstanceOid: null,
      owningIntegrationInstanceProviderOid: null
    };
    let ownedConfig = {
      id: 'pcf_owned',
      oid: 31n,
      status: 'active',
      owningIntegrationInstanceOid: 20n,
      owningIntegrationInstanceProviderOid: 10n
    };
    let sharedAuthConfig = {
      id: 'pac_shared',
      oid: 40n,
      status: 'active',
      owningIntegrationInstanceOid: null,
      owningIntegrationInstanceProviderOid: null
    };
    let ownedAuthConfig = {
      id: 'pac_owned',
      oid: 41n,
      status: 'active',
      owningIntegrationInstanceOid: 20n,
      owningIntegrationInstanceProviderOid: 10n
    };

    vi.mocked(db.integrationInstanceProvider.findUnique).mockResolvedValue(
      integrationInstanceProvider as any
    );
    vi.mocked(db.integrationInstanceGroupProvider.findMany).mockResolvedValue([]);
    vi.mocked(db.integrationInstanceProviderVersion.findMany).mockResolvedValue([
      { config: sharedConfig, authConfig: sharedAuthConfig },
      { config: ownedConfig, authConfig: ownedAuthConfig }
    ] as any);

    let processor = processors.get('sub/int/lc/integrationInstanceProvider/set');
    expect(processor).toBeDefined();

    await processor!({
      integrationInstanceId: 'ini_1',
      integrationInstanceProviderId: 'iip_1'
    });

    expect(providerConfigArchiveMock).toHaveBeenCalledTimes(1);
    expect(providerConfigArchiveMock).toHaveBeenCalledWith({
      tenant: integrationInstanceProvider.tenant,
      solution: integrationInstanceProvider.solution,
      environment: integrationInstanceProvider.environment,
      providerConfig: ownedConfig,
      _canArchiveOwned: true
    });
    expect(providerConfigArchiveMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ providerConfig: sharedConfig })
    );

    expect(providerAuthConfigArchiveMock).toHaveBeenCalledTimes(1);
    expect(providerAuthConfigArchiveMock).toHaveBeenCalledWith({
      tenant: integrationInstanceProvider.tenant,
      solution: integrationInstanceProvider.solution,
      environment: integrationInstanceProvider.environment,
      providerAuthConfig: ownedAuthConfig,
      _canArchiveOwned: true
    });
    expect(providerAuthConfigArchiveMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ providerAuthConfig: sharedAuthConfig })
    );
  });
});
