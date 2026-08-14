import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  processors,
  db,
  createQueueMock,
  repinIntegrationInstanceProvidersMock,
  enqueueSyncInstanceTemplatesMock,
  enqueueSyncGroupTemplatesMock,
  indexIntegrationQueueAddMock,
  reconcileSkillProviderLinksForIntegrationProviderQueueAddMock
} = vi.hoisted(() => {
  let processors = new Map<string, (data: any) => Promise<void>>();
  let db = {
    integrationProvider: {
      findUnique: vi.fn()
    },
    integrationInstanceProviderVersion: {
      findFirst: vi.fn()
    },
    integrationInstanceProviderVersionConfig: {
      createMany: vi.fn()
    },
    integrationInstanceProviderVersionAuthConfig: {
      createMany: vi.fn()
    },
    integrationInstanceProvider: {
      findMany: vi.fn(),
      updateMany: vi.fn()
    },
    integrationInstanceGroupProvider: {
      findMany: vi.fn(),
      updateMany: vi.fn()
    }
  };

  return {
    processors,
    db,
    createQueueMock: vi.fn((config: { name: string }) => {
      let queue = {
        add: vi.fn(),
        addMany: vi.fn(),
        addManyWithOps: vi.fn(),
        process: vi.fn((handler: (data: any) => Promise<void>) => {
          processors.set(config.name, handler);
          return { name: config.name };
        })
      };
      return queue;
    }),
    repinIntegrationInstanceProvidersMock: vi.fn(),
    enqueueSyncInstanceTemplatesMock: vi.fn(),
    enqueueSyncGroupTemplatesMock: vi.fn(),
    indexIntegrationQueueAddMock: vi.fn(),
    reconcileSkillProviderLinksForIntegrationProviderQueueAddMock: vi.fn()
  };
});

vi.mock('@lowerdeck/queue', () => ({
  createQueue: createQueueMock,
  QueueRetryError: class QueueRetryError extends Error {}
}));

vi.mock('@metorial-subspace/db', () => ({
  db
}));

vi.mock('@metorial-subspace/module-identity', () => ({
  identityInternalService: {
    syncIntegrationInstanceProviderCredentials: vi.fn()
  }
}));

vi.mock(
  '@metorial-subspace/module-session/src/queues/lifecycle/linkedSessionTemplate',
  () => ({
    enqueueSyncIntegrationInstanceSessionTemplatesMany: enqueueSyncInstanceTemplatesMock
  })
);

vi.mock(
  '@metorial-subspace/module-session/src/queues/lifecycle/linkedIntegrationInstanceGroupTemplate',
  () => ({
    enqueueSyncIntegrationInstanceGroupSessionTemplatesMany: enqueueSyncGroupTemplatesMock
  })
);

vi.mock('@metorial/cargo-module-skill', () => ({
  reconcileSkillProviderLinksForIntegrationProviderQueue: {
    add: reconcileSkillProviderLinksForIntegrationProviderQueueAddMock
  }
}));

vi.mock('../src/services/integrationInstanceProvider', () => ({
  integrationInstanceProviderService: {
    repinIntegrationInstanceProvidersToIntegrationProviderVersion:
      repinIntegrationInstanceProvidersMock
  }
}));

vi.mock('../src/queues/search/integration', () => ({
  indexIntegrationQueue: {
    add: indexIntegrationQueueAddMock
  }
}));

vi.mock('../src/queues/search/integrationInstance', () => ({
  indexIntegrationInstanceQueue: {
    add: vi.fn()
  }
}));

vi.mock('../src/queues/lifecycle/integrationInstanceProvider', () => ({
  enqueueIntegrationInstanceProvidersSet: vi.fn()
}));

vi.mock('../src/env', () => ({
  env: {
    service: {
      REDIS_URL: 'redis://test'
    }
  }
}));

import '../src/queues/lifecycle/integrationProvider';

describe('integration provider lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('repins instance providers before syncing instance session templates', async () => {
    let providerVersionOid = 20n;
    let integrationInstanceProvider = {
      id: 'iip_1',
      oid: 30n,
      integrationInstance: { id: 'ins_1' },
      currentVersion: {
        integrationProviderVersionOid: 10n,
        configOid: 40n,
        authConfigOid: null,
        toolFilter: { type: 'v1.filter', filters: [] },
        isOverrideToolFilter: false
      }
    };
    db.integrationProvider.findUnique.mockResolvedValue({
      oid: 1n,
      currentVersionOid: providerVersionOid
    });
    db.integrationInstanceProvider.findMany.mockResolvedValue([integrationInstanceProvider]);

    await processors.get('sub/int/lc/integrationProvider/updated/instance')!({
      integrationProviderId: 'ipr_1'
    });

    expect(repinIntegrationInstanceProvidersMock).toHaveBeenCalledWith({
      integrationProviderVersionOid: providerVersionOid,
      integrationInstanceProviders: [integrationInstanceProvider]
    });
    expect(repinIntegrationInstanceProvidersMock.mock.invocationCallOrder[0]).toBeLessThan(
      enqueueSyncInstanceTemplatesMock.mock.invocationCallOrder[0]
    );
    expect(enqueueSyncInstanceTemplatesMock).toHaveBeenCalledWith([
      { integrationInstanceId: 'ins_1' }
    ]);
  });

  it('repins source instance providers before syncing group session templates', async () => {
    let providerVersionOid = 20n;
    let integrationInstanceProvider = {
      oid: 30n,
      currentVersion: {
        integrationProviderVersionOid: 10n,
        configOid: 40n,
        authConfigOid: null,
        toolFilter: null,
        isOverrideToolFilter: false
      }
    };
    db.integrationProvider.findUnique.mockResolvedValue({
      oid: 1n,
      currentVersionOid: providerVersionOid
    });
    db.integrationInstanceGroupProvider.findMany.mockResolvedValue([
      {
        id: 'iigp_1',
        integrationInstanceGroup: { id: 'iig_1' },
        integrationInstanceProvider
      }
    ]);

    await processors.get('sub/int/lc/integrationProvider/updated/group')!({
      integrationProviderId: 'ipr_1'
    });

    expect(repinIntegrationInstanceProvidersMock).toHaveBeenCalledWith({
      integrationProviderVersionOid: providerVersionOid,
      integrationInstanceProviders: [integrationInstanceProvider]
    });
    expect(repinIntegrationInstanceProvidersMock.mock.invocationCallOrder[0]).toBeLessThan(
      enqueueSyncGroupTemplatesMock.mock.invocationCallOrder[0]
    );
    expect(enqueueSyncGroupTemplatesMock).toHaveBeenCalledWith([
      { integrationInstanceGroupId: 'iig_1' }
    ]);
  });
});
