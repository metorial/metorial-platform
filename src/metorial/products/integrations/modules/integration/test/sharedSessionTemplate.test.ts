import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  addAfterTransactionHookMock,
  withTransactionMock,
  db,
  getIdMock,
  ensureIntegrationIdentityMock,
  upsertInternalLinkedSessionTemplateMock,
  createSessionMock,
  integrationInstanceCreatedQueueAddMock,
  enqueueSyncIntegrationInstanceSessionTemplateMock,
  enqueueSyncIntegrationInstanceGroupSessionTemplateMock
} = vi.hoisted(() => ({
  ...(() => {
    let db = {
      integrationInstance: {
        create: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn(),
        findUniqueOrThrow: vi.fn()
      },
      integrationProvider: {
        findMany: vi.fn()
      },
      integrationInstanceGroup: {
        findFirst: vi.fn(),
        findUniqueOrThrow: vi.fn()
      }
    };

    return {
      addAfterTransactionHookMock: vi.fn(async (callback: () => Promise<void>) => {
        await callback();
      }),
      withTransactionMock: vi.fn(async (callback: (transactionDb: any) => Promise<any>) =>
        callback(db)
      ),
      db
    };
  })(),
  getIdMock: vi.fn((prefix: string) => ({
    id: `${prefix}_generated`
  })),
  ensureIntegrationIdentityMock: vi.fn(),
  upsertInternalLinkedSessionTemplateMock: vi.fn(),
  createSessionMock: vi.fn(),
  integrationInstanceCreatedQueueAddMock: vi.fn(),
  enqueueSyncIntegrationInstanceSessionTemplateMock: vi.fn(),
  enqueueSyncIntegrationInstanceGroupSessionTemplateMock: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  addAfterTransactionHook: addAfterTransactionHookMock,
  db,
  getId: getIdMock,
  withTransaction: withTransactionMock
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_: string, factory: () => unknown) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: {
    create: vi.fn()
  }
}));

vi.mock('@metorial-subspace/list-utils', () => ({
  checkDeletedEdit: vi.fn(),
  checkDeletedRelation: vi.fn(),
  normalizeDateFilter: vi.fn(),
  normalizeStatusForGet: vi.fn(() => ({ hasParent: {}, noParent: {} })),
  normalizeStatusForList: vi.fn(() => ({ hasParent: {}, noParent: {} })),
  resolveIdentities: vi.fn(),
  resolveIdentityActors: vi.fn(),
  resolveIdentityCredentials: vi.fn(),
  resolveIntegrationProviders: vi.fn(),
  resolveIntegrations: vi.fn(),
  resolveProviderAuthConfigs: vi.fn(),
  resolveProviderConfigs: vi.fn(),
  resolveProviderDeployments: vi.fn(),
  resolveProviders: vi.fn(),
  resolveSessionTemplates: vi.fn(),
  resolveIntegrationInstanceProviders: vi.fn(),
  resolveIntegrationInstanceGroups: vi.fn(),
  resolveIntegrationInstances: vi.fn()
}));

vi.mock('@metorial-subspace/module-deployment', () => ({
  providerConfigService: {
    createProviderConfigInternal: vi.fn()
  }
}));

vi.mock('@metorial-subspace/module-identity', () => ({
  identityActorService: {
    getIdentityActorById: vi.fn()
  },
  identityInternalService: {
    ensureIntegrationIdentity: ensureIntegrationIdentityMock
  }
}));

vi.mock('@metorial-subspace/module-session', () => ({
  sessionService: {
    createSessionInternal: createSessionMock
  },
  sessionTemplateService: {
    upsertInternalLinkedSessionTemplateInternal: upsertInternalLinkedSessionTemplateMock
  }
}));

vi.mock('@metorial-subspace/module-search', () => ({
  voyager: {
    record: {
      search: vi.fn()
    }
  },
  voyagerIndex: {
    integrationInstance: {
      id: 'integration-instance-index'
    }
  },
  voyagerSource: Promise.resolve({ id: 'voyager-source' })
}));

vi.mock(
  '@metorial-subspace/module-session/src/queues/lifecycle/linkedSessionTemplate',
  () => ({
    enqueueSyncIntegrationInstanceSessionTemplate:
      enqueueSyncIntegrationInstanceSessionTemplateMock
  })
);

vi.mock(
  '@metorial-subspace/module-session/src/queues/lifecycle/linkedIntegrationInstanceGroupTemplate',
  () => ({
    enqueueSyncIntegrationInstanceGroupSessionTemplate:
      enqueueSyncIntegrationInstanceGroupSessionTemplateMock
  })
);

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  getMetorialSolution: vi.fn(async () => ({ oid: 2n, id: 'sol_1' }))
}));

vi.mock('../src/queues/lifecycle/integrationInstance', () => ({
  integrationInstanceArchivedQueue: { add: vi.fn() },
  integrationInstanceCreatedQueue: { add: integrationInstanceCreatedQueueAddMock },
  integrationInstanceUpdatedQueue: { add: vi.fn() }
}));

vi.mock('../src/queues/lifecycle/integrationInstanceGroup', () => ({
  integrationInstanceGroupArchivedQueue: { add: vi.fn() },
  integrationInstanceGroupCreatedQueue: { add: vi.fn() },
  integrationInstanceGroupUpdatedQueue: { add: vi.fn() }
}));

vi.mock('../src/services/integration', () => ({
  integrationProviderVersionInclude: {}
}));

vi.mock('../src/services/integrationInstanceProvider', () => ({
  integrationInstanceProviderService: {
    setIntegrationInstanceProvidersInternal: vi.fn()
  }
}));

vi.mock('../src/services/integrationInstanceGroupProvider', () => ({
  integrationInstanceGroupProviderService: {
    setIntegrationInstanceGroupProviders: vi.fn()
  }
}));

import { integrationInstanceGroupService } from '../src/services/integrationInstanceGroup';
import { integrationInstanceService } from '../src/services/integrationInstance';

describe('shared integration session templates', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    withTransactionMock.mockImplementation(async (callback: (db: any) => Promise<any>) =>
      callback(db)
    );
    addAfterTransactionHookMock.mockImplementation(async (callback: () => Promise<void>) => {
      await callback();
    });
    getIdMock.mockImplementation((prefix: string) => ({
      id: `${prefix}_generated`
    }));
    ensureIntegrationIdentityMock.mockResolvedValue({
      actor: null,
      identity: null
    });
  });

  it('defers default shared template creation when creating an integration instance', async () => {
    let createdIntegrationInstance = {
      oid: 11n,
      id: 'int_instance_1',
      identityActorOid: null,
      identityOid: null,
      defaultSessionTemplate: null
    };
    let integrationInstanceWithIdentity = {
      ...createdIntegrationInstance,
      name: 'GitHub'
    };
    let refreshedIntegrationInstance = {
      ...integrationInstanceWithIdentity,
      defaultSessionTemplate: { oid: 101n, id: 'stm_default' }
    };

    vi.mocked(db.integrationProvider.findMany).mockResolvedValue([]);
    vi.mocked(db.integrationInstance.create).mockResolvedValue(
      createdIntegrationInstance as any
    );
    vi.mocked(db.integrationInstance.update).mockResolvedValue(
      integrationInstanceWithIdentity as any
    );
    vi.mocked(db.integrationInstance.findUniqueOrThrow).mockResolvedValue(
      refreshedIntegrationInstance as any
    );

    let result = await integrationInstanceService.createIntegrationInstanceInternal({
      tenant: { oid: 1n } as any,
      environment: { oid: 3n } as any,
      integration: { oid: 4n } as any,
      input: {
        name: 'GitHub'
      }
    });

    expect(upsertInternalLinkedSessionTemplateMock).not.toHaveBeenCalled();
    expect(db.integrationInstance.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { oid: integrationInstanceWithIdentity.oid },
      include: expect.anything()
    });
    expect(integrationInstanceCreatedQueueAddMock).toHaveBeenCalledWith({
      integrationInstanceId: 'int_instance_1'
    });
    expect(result).toBe(refreshedIntegrationInstance);
  });

  it('creates a session for an integration instance after the default template is ready', async () => {
    let template = {
      id: 'stm_default',
      providers: [
        {
          id: 'stp_1',
          deployment: { id: 'dep_1' },
          config: { id: 'cfg_1' },
          authConfig: null
        }
      ]
    };
    let integrationInstance = {
      oid: 11n,
      id: 'int_instance_1'
    } as any;
    let createdSession = { id: 'ses_1' };

    vi.mocked(db.integrationInstance.findFirst).mockResolvedValue({
      defaultSessionTemplate: template,
      integrationInstanceProviders: [{ oid: 101n }]
    } as any);
    createSessionMock.mockResolvedValue(createdSession);

    let result = await integrationInstanceService.createSessionForIntegrationInstanceInternal({
      tenant: { oid: 1n } as any,
      environment: { oid: 3n } as any,
      integrationInstance,
      input: { name: 'Session' }
    });

    expect(createSessionMock).toHaveBeenCalledWith({
      tenant: expect.anything(),
      environment: expect.anything(),
      input: {
        name: 'Session',
        providers: [
          {
            sessionTemplateId: 'stm_default',
            __sessionTemplate: template
          }
        ]
      }
    });
    expect(result).toBe(createdSession);
  });

  it('times out when an integration instance default template is not ready', async () => {
    vi.useFakeTimers();
    vi.mocked(db.integrationInstance.findFirst).mockResolvedValue({
      defaultSessionTemplate: null,
      integrationInstanceProviders: []
    } as any);

    let promise = integrationInstanceService.createSessionForIntegrationInstanceInternal({
      tenant: { oid: 1n } as any,
      environment: { oid: 3n } as any,
      integrationInstance: { oid: 11n, id: 'int_instance_1' } as any,
      input: {}
    });
    let rejection = expect(promise).rejects.toThrow();

    await vi.advanceTimersByTimeAsync(250 * 20);
    await rejection;
    expect(createSessionMock).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('upserts the default shared template for an integration instance', async () => {
    let existingTemplate = { oid: 101n, id: 'stm_existing' };
    let createdTemplate = { id: 'stm_default' };

    vi.mocked(db.integrationInstance.findUniqueOrThrow).mockResolvedValue({
      defaultSessionTemplate: existingTemplate
    } as any);
    upsertInternalLinkedSessionTemplateMock.mockResolvedValue(createdTemplate);

    let integrationInstance = {
      oid: 11n,
      id: 'int_instance_1',
      identityActorOid: 501n,
      identityOid: 601n
    } as any;

    let result =
      await integrationInstanceService.createSessionTemplateForIntegrationInstanceInternal({
        tenant: { oid: 1n } as any,
        environment: { oid: 3n } as any,
        integrationInstance,
        input: {
          name: 'Shared template',
          description: 'Used for session creation',
          metadata: { team: 'ops' }
        }
      });

    expect(upsertInternalLinkedSessionTemplateMock).toHaveBeenCalledWith({
      tenant: expect.anything(),
      environment: expect.anything(),
      sessionTemplate: existingTemplate,
      input: {
        name: 'Shared template',
        description: 'Used for session creation',
        metadata: { team: 'ops' },
        privateMetadata: undefined,
        integrationInstance
      }
    });
    expect(enqueueSyncIntegrationInstanceSessionTemplateMock).toHaveBeenCalledWith(
      'stm_default'
    );
    expect(result).toBe(createdTemplate);
  });

  it('upserts the default shared template for an integration instance group', async () => {
    let existingTemplate = { oid: 202n, id: 'stm_group_existing' };
    let createdTemplate = { id: 'stm_group_default' };
    let integrationInstanceGroup = { oid: 22n, id: 'int_group_1' } as any;
    let currentIntegrationInstanceGroup = {
      ...integrationInstanceGroup,
      identityActorOid: 502n,
      identityOid: 602n,
      defaultSessionTemplate: existingTemplate
    };

    vi.mocked(db.integrationInstanceGroup.findUniqueOrThrow).mockResolvedValue(
      currentIntegrationInstanceGroup as any
    );
    upsertInternalLinkedSessionTemplateMock.mockResolvedValue(createdTemplate);

    let result =
      await integrationInstanceGroupService.createSessionTemplateForIntegrationInstanceGroupInternal(
        {
          tenant: { oid: 1n } as any,
          environment: { oid: 3n } as any,
          integrationInstanceGroup,
          input: {
            name: 'Shared group template',
            description: 'Used for grouped sessions',
            metadata: { region: 'eu-central' }
          }
        }
      );

    expect(upsertInternalLinkedSessionTemplateMock).toHaveBeenCalledWith({
      tenant: expect.anything(),
      environment: expect.anything(),
      sessionTemplate: existingTemplate,
      input: {
        name: 'Shared group template',
        description: 'Used for grouped sessions',
        metadata: { region: 'eu-central' },
        privateMetadata: undefined,
        integrationInstanceGroup: currentIntegrationInstanceGroup
      }
    });
    expect(enqueueSyncIntegrationInstanceGroupSessionTemplateMock).toHaveBeenCalledWith(
      'stm_group_default'
    );
    expect(result).toBe(createdTemplate);
  });

  it('creates a session for an integration instance group after the default template is ready', async () => {
    let template = {
      id: 'stm_group_default',
      providers: [
        {
          id: 'stp_group_1',
          deployment: { id: 'dep_1' },
          config: { id: 'cfg_1' },
          authConfig: null
        }
      ]
    };
    let integrationInstanceGroup = {
      oid: 22n,
      id: 'int_group_1'
    } as any;
    let createdSession = { id: 'ses_group_1' };

    vi.mocked(db.integrationInstanceGroup.findFirst).mockResolvedValue({
      defaultSessionTemplate: template,
      providers: [{ oid: 101n }]
    } as any);
    createSessionMock.mockResolvedValue(createdSession);

    let result =
      await integrationInstanceGroupService.createSessionForIntegrationInstanceGroupInternal({
        tenant: { oid: 1n } as any,
        environment: { oid: 3n } as any,
        integrationInstanceGroup,
        input: { name: 'Grouped session' }
      });

    expect(createSessionMock).toHaveBeenCalledWith({
      tenant: expect.anything(),
      environment: expect.anything(),
      input: {
        name: 'Grouped session',
        providers: [
          {
            sessionTemplateId: 'stm_group_default',
            __sessionTemplate: template
          }
        ]
      }
    });
    expect(result).toBe(createdSession);
  });

  it('times out when an integration instance group default template is not ready', async () => {
    vi.useFakeTimers();
    vi.mocked(db.integrationInstanceGroup.findFirst).mockResolvedValue({
      defaultSessionTemplate: null,
      providers: []
    } as any);

    let promise = integrationInstanceGroupService.createSessionForIntegrationInstanceGroupInternal(
      {
        tenant: { oid: 1n } as any,
        environment: { oid: 3n } as any,
        integrationInstanceGroup: { oid: 22n, id: 'int_group_1' } as any,
        input: {}
      }
    );
    let rejection = expect(promise).rejects.toThrow();

    await vi.advanceTimersByTimeAsync(250 * 20);
    await rejection;
    expect(createSessionMock).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
