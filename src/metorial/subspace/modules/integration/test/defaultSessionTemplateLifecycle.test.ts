import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  processors,
  db,
  createQueueMock,
  createInstanceTemplateMock,
  createGroupTemplateMock,
  enqueueSyncInstanceTemplatesMock,
  enqueueSyncGroupTemplatesMock,
  indexIntegrationInstanceQueueAddMock,
  syncProviderCredentialsMock
} = vi.hoisted(() => {
  let processors = new Map<string, (data: any) => Promise<void>>();
  let db = {
    integrationInstance: {
      findUnique: vi.fn()
    },
    integrationInstanceGroup: {
      findUnique: vi.fn()
    },
    integrationInstanceProvider: {
      findMany: vi.fn()
    }
  };

  return {
    processors,
    db,
    createQueueMock: vi.fn((config: { name: string }) => ({
      add: vi.fn(),
      addMany: vi.fn(),
      addManyWithOps: vi.fn(),
      process: vi.fn((handler: (data: any) => Promise<void>) => {
        processors.set(config.name, handler);
        return { name: config.name };
      })
    })),
    createInstanceTemplateMock: vi.fn(),
    createGroupTemplateMock: vi.fn(),
    enqueueSyncInstanceTemplatesMock: vi.fn(),
    enqueueSyncGroupTemplatesMock: vi.fn(),
    indexIntegrationInstanceQueueAddMock: vi.fn(),
    syncProviderCredentialsMock: vi.fn()
  };
});

vi.mock('@lowerdeck/queue', () => ({
  createQueue: createQueueMock
}));

vi.mock('@metorial-subspace/db', () => ({
  db
}));

vi.mock('@metorial-subspace/module-identity', () => ({
  identityInternalService: {
    syncIntegrationInstanceProviderCredentials: syncProviderCredentialsMock
  }
}));

vi.mock(
  '@metorial-subspace/module-session/src/queues/lifecycle/linkedSessionTemplate',
  () => ({
    enqueueArchiveIntegrationInstanceSessionTemplates: vi.fn(),
    enqueueSyncIntegrationInstanceSessionTemplates: enqueueSyncInstanceTemplatesMock
  })
);

vi.mock(
  '@metorial-subspace/module-session/src/queues/lifecycle/linkedIntegrationInstanceGroupTemplate',
  () => ({
    enqueueArchiveIntegrationInstanceGroupSessionTemplates: vi.fn(),
    enqueueSyncIntegrationInstanceGroupSessionTemplates: enqueueSyncGroupTemplatesMock,
    enqueueSyncIntegrationInstanceGroupSessionTemplatesMany: vi.fn()
  })
);

vi.mock('@metorial-subspace/module-identity/src/queues/lifecycle/identity', () => ({
  identityDeletedQueue: { addMany: vi.fn() }
}));

vi.mock('../src/queues/search/integrationInstance', () => ({
  indexIntegrationInstanceQueue: {
    add: indexIntegrationInstanceQueueAddMock
  }
}));

vi.mock('../src/queues/lifecycle/integrationInstanceProvider', () => ({
  enqueueIntegrationInstanceProvidersSet: vi.fn()
}));

vi.mock('../src/queues/lifecycle/integrationInstanceGroupProvider', () => ({
  enqueueIntegrationInstanceGroupProvidersSet: vi.fn()
}));

vi.mock('../src/services/integrationInstance', () => ({
  integrationInstanceService: {
    createSessionTemplateForIntegrationInstanceInternal: createInstanceTemplateMock
  }
}));

vi.mock('../src/services/integrationInstanceGroup', () => ({
  integrationInstanceGroupService: {
    createSessionTemplateForIntegrationInstanceGroupInternal: createGroupTemplateMock
  }
}));

vi.mock('../src/env', () => ({
  env: {
    service: {
      REDIS_URL: 'redis://test'
    }
  }
}));

import '../src/queues/lifecycle/integrationInstance';
import '../src/queues/lifecycle/integrationInstanceGroup';

describe('default session template lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an integration instance default session template in the created job', async () => {
    let integrationInstance = {
      id: 'ini_1',
      status: 'active',
      tenant: { oid: 1n },
      solution: { oid: 2n },
      environment: { oid: 3n }
    };
    vi.mocked(db.integrationInstance.findUnique).mockResolvedValue(integrationInstance as any);
    vi.mocked(db.integrationInstanceProvider.findMany).mockResolvedValue([]);

    let processor = processors.get('sub/int/lc/integrationInstance/created');
    expect(processor).toBeDefined();

    await processor!({ integrationInstanceId: 'ini_1' });

    expect(createInstanceTemplateMock).toHaveBeenCalledWith({
      tenant: integrationInstance.tenant,
      environment: integrationInstance.environment,
      integrationInstance,
      input: {}
    });
    expect(enqueueSyncInstanceTemplatesMock).toHaveBeenCalledWith({
      integrationInstanceId: 'ini_1'
    });
    expect(syncProviderCredentialsMock).not.toHaveBeenCalled();
  });

  it('creates an integration instance group default session template in the created job', async () => {
    let integrationInstanceGroup = {
      id: 'iig_1',
      status: 'active',
      tenant: { oid: 1n },
      solution: { oid: 2n },
      environment: { oid: 3n }
    };
    vi.mocked(db.integrationInstanceGroup.findUnique).mockResolvedValue(
      integrationInstanceGroup as any
    );

    let processor = processors.get('sub/int/lc/integrationInstanceGroup/created');
    expect(processor).toBeDefined();

    await processor!({ integrationInstanceGroupId: 'iig_1' });

    expect(createGroupTemplateMock).toHaveBeenCalledWith({
      tenant: integrationInstanceGroup.tenant,
      environment: integrationInstanceGroup.environment,
      integrationInstanceGroup,
      input: {}
    });
    expect(enqueueSyncGroupTemplatesMock).toHaveBeenCalledWith({
      integrationInstanceGroupId: 'iig_1'
    });
  });
});
