import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  let tx = {
    callback: {
      create: vi.fn(),
      update: vi.fn()
    },
    callbackProviderTrigger: {
      deleteMany: vi.fn(),
      createMany: vi.fn()
    },
    callbackDestinationLink: {
      deleteMany: vi.fn(),
      createMany: vi.fn()
    },
    callbackInstance: {
      updateMany: vi.fn()
    }
  };
  return {
    tx,
    callbackFindFirst: vi.fn(),
    callbackFindUnique: vi.fn(),
    callbackDestinationFindMany: vi.fn(),
    integrationProviderFindFirst: vi.fn(),
    resolveTriggers: vi.fn(),
    getSchema: vi.fn(),
    setConfig: vi.fn(),
    clearConfig: vi.fn(),
    ensureMaterialized: vi.fn(),
    syncCallback: vi.fn(),
    enqueueConfigDelete: vi.fn(),
    fabricFire: vi.fn()
  };
});

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('./callbackDestination', () => ({
  callbackDestinationService: {
    ensureMaterializedInternal: mocks.ensureMaterialized
  }
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: {
    create: vi.fn(),
    present: vi.fn(),
    validate: vi.fn()
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    callback: {
      findFirst: mocks.callbackFindFirst,
      findUnique: mocks.callbackFindUnique
    },
    callbackDestination: {
      findMany: mocks.callbackDestinationFindMany
    },
    integrationProvider: {
      findFirst: mocks.integrationProviderFindFirst
    }
  },
  CallbackDestinationStatus: { active: 'active', archived: 'archived', deleted: 'deleted' },
  getId: (model: string) => ({ oid: 900n, id: `${model}_1` }),
  snowflake: { nextId: () => 901n },
  withTransaction: vi.fn(async (cb: (tx: typeof mocks.tx) => unknown) => cb(mocks.tx))
}));

vi.mock('@metorial-subspace/list-utils', () => ({
  normalizeDateFilter: vi.fn(),
  normalizeStatusForGet: () => ({ noParent: {} }),
  normalizeStatusForList: () => ({ noParent: {} }),
  resolveIntegrationProviders: vi.fn(),
  resolveIntegrations: vi.fn(),
  resolveProviderDeployments: vi.fn()
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  getMetorialSolution: async () => ({ oid: 1 }),
  resolveMetorialFacing: async () => ({
    tenant: { oid: 10n, projectOid: 20n },
    environment: { oid: 11n, instanceOid: 21n }
  }),
  toProviderEventBase: vi.fn(() => ({ instance: { id: 'ins_1' }, input: {} }))
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: mocks.fabricFire }
}));

vi.mock('../lib/resolveCallbackProviderTriggers', () => ({
  resolveCallbackProviderTriggers: mocks.resolveTriggers
}));

vi.mock('../queues/deleteCallbackConfigBacking', () => ({
  callbackConfigBackingDeleteQueue: { add: mocks.enqueueConfigDelete }
}));

vi.mock('./callbackConfig', () => ({
  callbackConfigService: {
    getCallbackConfigSchemaInternal: mocks.getSchema,
    setCallbackConfigInternal: mocks.setConfig,
    clearCallbackConfigInternal: mocks.clearConfig
  }
}));

vi.mock('./callbackRegistration', () => ({
  callbackRegistrationService: { syncCallback: mocks.syncCallback }
}));

import { callbackService } from './callback';

let deployment = {
  oid: 30n,
  provider: {
    type: {
      attributes: {
        backend: 'slates',
        triggers: { status: 'enabled' }
      }
    }
  }
};

let integration = {
  oid: 32n,
  id: 'int_1',
  name: 'Orders',
  tenantOid: 10n,
  projectOid: 20n,
  solutionOid: 1,
  environmentOid: 11n,
  instanceOid: 21n
};

let integrationProvider = {
  oid: 31n,
  id: 'intp_1',
  name: 'Acme',
  integrationOid: integration.oid,
  integration,
  currentVersion: { deployment }
};

let providerTrigger = {
  oid: 50n,
  id: 'ptr_1',
  specificationOid: 40n,
  specId: 'spec_1'
};

let baseCallback = {
  oid: 70n,
  id: 'clb_1',
  tenantOid: 10n,
  projectOid: 20n,
  solutionOid: 1,
  environmentOid: 11n,
  instanceOid: 21n,
  integrationOid: integration.oid,
  integrationProviderOid: integrationProvider.oid,
  providerDeploymentOid: deployment.oid,
  callbackConfigOid: null,
  status: 'active'
};

let internalParams = (overrides: Record<string, unknown> = {}) =>
  ({
    tenant: { oid: 10n, projectOid: 20n },
    environment: { oid: 11n, instanceOid: 21n },
    integrationProvider: { oid: 31n, id: 'intp_1' },
    input: {
      triggers: [{ triggerId: 'spec_1' }],
      destinationIds: ['cbd_1'],
      configValues: { signing_key: 'secret' }
    },
    ...overrides
  }) as any;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.callbackFindFirst.mockReset();
  mocks.callbackFindUnique.mockReset();
  mocks.integrationProviderFindFirst.mockResolvedValue(integrationProvider);
  mocks.resolveTriggers.mockResolvedValue([{ providerTrigger, eventTypes: [] }]);
  mocks.getSchema.mockResolvedValue({ schema: { type: 'object' } });
  mocks.callbackDestinationFindMany.mockResolvedValue([{ oid: 60n, id: 'cbd_1' }]);
  mocks.callbackFindUnique.mockResolvedValue(null);
  mocks.callbackFindFirst.mockResolvedValue(baseCallback);
  mocks.tx.callback.create.mockResolvedValue(baseCallback);
  mocks.tx.callback.update.mockResolvedValue(baseCallback);
  mocks.setConfig.mockResolvedValue({
    supersededCallbackConfigVersionId: 'ccv_old'
  });
  mocks.clearConfig.mockResolvedValue({ supersededCallbackConfigVersionId: null });
});

describe('integration-provider callback upsert', () => {
  it('only exposes active callback destinations', async () => {
    await callbackService.getCallbackForIntegrationProviderInternal({
      tenant: { oid: 10n },
      environment: { oid: 11n },
      integrationProvider: { oid: 31n }
    } as any);

    expect(mocks.callbackFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          callbackDestinationLinks: {
            where: {
              callbackDestination: {
                status: 'active'
              }
            },
            include: {
              callbackDestination: true
            }
          }
        })
      })
    );
  });

  it('rejects an empty trigger selection before resolving provider state', async () => {
    await expect(
      callbackService.upsertCallbackForIntegrationProviderInternal(
        internalParams({ input: { triggers: [] } })
      )
    ).rejects.toMatchObject({ data: { code: 'callback_requires_trigger' } });

    expect(mocks.integrationProviderFindFirst).not.toHaveBeenCalled();
    expect(mocks.tx.callback.create).not.toHaveBeenCalled();
  });

  it('derives ownership, defaults the name, publishes config, and cleans up after sync', async () => {
    await callbackService.upsertCallbackForIntegrationProviderInternal(internalParams());

    expect(mocks.ensureMaterialized).toHaveBeenCalledWith({
      tenant: expect.objectContaining({ oid: 10n }),
      callbackDestination: { oid: 60n, id: 'cbd_1' }
    });
    expect(mocks.tx.callback.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantOid: integration.tenantOid,
        projectOid: integration.projectOid,
        environmentOid: integration.environmentOid,
        instanceOid: integration.instanceOid,
        integrationOid: integration.oid,
        integrationProviderOid: integrationProvider.oid,
        providerDeploymentOid: deployment.oid,
        name: integrationProvider.name
      })
    });
    expect(mocks.setConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        callback: baseCallback,
        providerTriggers: [providerTrigger],
        valuesPatch: { signing_key: 'secret' },
        db: mocks.tx
      })
    );
    expect(mocks.tx.callbackProviderTrigger.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          callbackOid: baseCallback.oid,
          providerTriggerOid: providerTrigger.oid
        })
      ]
    });
    expect(mocks.syncCallback).toHaveBeenCalledWith({ callbackId: baseCallback.id });
    expect(mocks.enqueueConfigDelete).toHaveBeenCalledWith({
      callbackConfigVersionId: 'ccv_old'
    });
    expect(mocks.syncCallback.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.enqueueConfigDelete.mock.invocationCallOrder[0]!
    );
  });

  it('reactivates the same callback row and clears config when the schema disappears', async () => {
    let archived = { ...baseCallback, status: 'archived', archivedAt: new Date() };
    mocks.callbackFindUnique.mockResolvedValue(archived);
    mocks.callbackFindFirst.mockResolvedValue(baseCallback);
    mocks.getSchema.mockResolvedValue({ schema: null });
    mocks.tx.callback.update.mockResolvedValue({ ...archived, status: 'active' });

    let callback = await callbackService.upsertCallbackForIntegrationProviderInternal(
      internalParams({ input: { triggers: [{ triggerId: 'spec_1' }] } })
    );

    expect(mocks.tx.callback.create).not.toHaveBeenCalled();
    expect(mocks.tx.callback.update).toHaveBeenCalledWith({
      where: { oid: archived.oid },
      data: expect.objectContaining({ status: 'active', archivedAt: null })
    });
    expect(mocks.clearConfig).toHaveBeenCalled();
    expect(callback.id).toBe(archived.id);
  });

  it('does not enqueue superseded config deletion when reconciliation fails', async () => {
    mocks.syncCallback.mockRejectedValue(new Error('sync failed'));

    await expect(
      callbackService.upsertCallbackForIntegrationProviderInternal(internalParams())
    ).rejects.toThrow('sync failed');

    expect(mocks.enqueueConfigDelete).not.toHaveBeenCalled();
  });

  it('fires created and updated lifecycle events from the public wrapper', async () => {
    let instance = { id: 'ins_1' };
    vi.spyOn(
      callbackService,
      'upsertCallbackForIntegrationProviderInternal'
    ).mockResolvedValue(baseCallback as any);

    mocks.callbackFindUnique.mockResolvedValueOnce(null);
    await callbackService.upsertCallbackForIntegrationProvider({
      instance,
      integrationProvider: integrationProvider as any,
      input: { triggers: [{ triggerId: 'spec_1' }] }
    } as any);
    expect(mocks.fabricFire).toHaveBeenCalledWith(
      'provider.callback.created:after',
      expect.objectContaining({ callback: baseCallback })
    );

    mocks.callbackFindUnique.mockResolvedValueOnce(baseCallback);
    await callbackService.upsertCallbackForIntegrationProvider({
      instance,
      integrationProvider: integrationProvider as any,
      input: { triggers: [{ triggerId: 'spec_1' }] }
    } as any);
    expect(mocks.fabricFire).toHaveBeenCalledWith(
      'provider.callback.updated:after',
      expect.objectContaining({ callback: baseCallback })
    );
  });

  it('archives callback instances and synchronizes their detach lifecycle', async () => {
    let archived = { ...baseCallback, status: 'archived', archivedAt: new Date() };
    mocks.tx.callback.update.mockResolvedValue(archived);
    mocks.syncCallback.mockResolvedValue(undefined);

    await callbackService.archiveCallbackInternal({
      tenant: { oid: baseCallback.tenantOid },
      environment: { oid: baseCallback.environmentOid },
      callback: baseCallback
    } as any);

    expect(mocks.tx.callbackInstance.updateMany).toHaveBeenCalledWith({
      where: { callbackOid: baseCallback.oid },
      data: { isParentDeleted: true }
    });
    expect(mocks.syncCallback).toHaveBeenCalledWith({ callbackId: baseCallback.id });
  });
});
