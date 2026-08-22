import { beforeEach, describe, expect, it, vi } from 'vitest';
import { badRequestError, ServiceError } from '@lowerdeck/error';

let mocks = vi.hoisted(() => {
  let processors = new Map<string, (data: any) => Promise<void>>();
  let queues = new Map<
    string,
    { add: ReturnType<typeof vi.fn>; addMany: ReturnType<typeof vi.fn> }
  >();
  let tx = {
    callback: { update: vi.fn() },
    callbackProviderTrigger: { deleteMany: vi.fn(), createMany: vi.fn() }
  };
  return {
    processors,
    queues,
    tx,
    integrationInstanceProviderFindUnique: vi.fn(),
    integrationInstanceProviderFindMany: vi.fn(),
    integrationProviderFindUnique: vi.fn(),
    callbackFindUnique: vi.fn(),
    callbackInstanceFindFirst: vi.fn(),
    callbackInstanceFindMany: vi.fn(),
    attach: vi.fn(),
    detach: vi.fn(),
    archiveCallback: vi.fn(),
    syncCallback: vi.fn(),
    resolveTriggers: vi.fn(),
    getConfigSchema: vi.fn(),
    setConfig: vi.fn(),
    clearConfig: vi.fn(),
    deleteConfigBacking: vi.fn()
  };
});

vi.mock('@lowerdeck/queue', () => ({
  QueueRetryError: class QueueRetryError extends Error {},
  createQueue: vi.fn((options: { name: string }) => {
    let queue = {
      add: vi.fn(),
      addMany: vi.fn(),
      process: vi.fn((processor: (data: any) => Promise<void>) => {
        mocks.processors.set(options.name, processor);
        return processor;
      })
    };
    mocks.queues.set(options.name, queue);
    return queue;
  })
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    integrationInstanceProvider: {
      findUnique: mocks.integrationInstanceProviderFindUnique,
      findMany: mocks.integrationInstanceProviderFindMany
    },
    integrationProvider: { findUnique: mocks.integrationProviderFindUnique },
    callback: { findUnique: mocks.callbackFindUnique },
    callbackInstance: {
      findFirst: mocks.callbackInstanceFindFirst,
      findMany: mocks.callbackInstanceFindMany
    }
  },
  getId: () => ({ oid: 900n, id: 'callback_provider_trigger_1' }),
  withTransaction: vi.fn(async callback => await callback(mocks.tx))
}));

vi.mock('../lib/resolveCallbackProviderTriggers', () => ({
  resolveCallbackProviderTriggers: mocks.resolveTriggers
}));
vi.mock('../services/callbackRegistration', () => ({
  callbackRegistrationService: { syncCallback: mocks.syncCallback }
}));
vi.mock('../services/callbackConfig', () => ({
  callbackConfigService: {
    getCallbackConfigSchemaInternal: mocks.getConfigSchema,
    setCallbackConfigInternal: mocks.setConfig,
    clearCallbackConfigInternal: mocks.clearConfig
  }
}));
vi.mock('../services/callbackInstance', () => ({
  callbackInstanceService: {
    attachInternal: mocks.attach,
    detachInternal: mocks.detach
  }
}));
vi.mock('../services/callback', () => ({
  callbackService: { archiveCallbackInternal: mocks.archiveCallback }
}));
vi.mock('../env', () => ({ env: { service: { REDIS_URL: 'redis://test' } } }));
vi.mock('./deleteCallbackConfigBacking', () => ({
  callbackConfigBackingDeleteQueue: { add: mocks.deleteConfigBacking }
}));

import './integrationReconcile';

let tenant = { oid: 1n, id: 'tenant_1' };
let environment = { oid: 2n, id: 'environment_1' };
let config = { oid: 3n, id: 'config_1' };
let deployment = { oid: 4n, id: 'deployment_1' };
let callback = {
  oid: 5n,
  id: 'callback_1',
  status: 'active',
  integrationOid: 6n,
  integrationProviderOid: 7n,
  providerDeploymentOid: deployment.oid,
  providerDeployment: deployment,
  callbackProviderTriggers: [],
  callbackConfig: null
};
let integrationInstanceProvider = {
  oid: 8n,
  id: 'integration_instance_provider_1',
  status: 'active',
  isParentDeleted: false,
  integrationOid: callback.integrationOid,
  integrationProviderOid: callback.integrationProviderOid,
  integrationInstanceOid: 9n,
  tenant,
  environment,
  integrationInstance: {
    oid: 9n,
    id: 'integration_instance_1',
    status: 'active',
    isParentDeleted: false,
    integrationOid: callback.integrationOid
  },
  currentVersionOid: 10n,
  currentVersion: {
    id: 'integration_instance_provider_version_1',
    status: 'active',
    config,
    authConfig: null
  },
  integrationProvider: {
    oid: callback.integrationProviderOid,
    id: 'integration_provider_1',
    status: 'active',
    currentVersion: {
      status: 'active',
      deploymentOid: deployment.oid,
      deployment,
      config: null
    }
  }
};

let integrationProcessor = () => mocks.processors.get('sub/callback/integration/reconcile')!;
let fanoutProcessor = () => mocks.processors.get('sub/callback/integration/fanout')!;
let providerProcessor = () =>
  mocks.processors.get('sub/callback/integration/provider-reconcile')!;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.integrationInstanceProviderFindUnique.mockResolvedValue(integrationInstanceProvider);
  mocks.callbackFindUnique.mockResolvedValue(callback);
  mocks.callbackInstanceFindFirst.mockResolvedValue(null);
  mocks.attach.mockResolvedValue({ id: 'callback_instance_1' });
  mocks.callbackInstanceFindMany.mockResolvedValue([]);
  mocks.resolveTriggers.mockResolvedValue([]);
  mocks.getConfigSchema.mockResolvedValue({ schema: null });
  mocks.clearConfig.mockResolvedValue({ supersededCallbackConfigVersionId: null });
  mocks.tx.callback.update.mockResolvedValue(callback);
});

describe('integration callback reconciliation', () => {
  it('attaches a configured provider idempotently through the stable provider identity', async () => {
    let input = {
      integrationInstanceProviderId: integrationInstanceProvider.id,
      targetVersionId: integrationInstanceProvider.currentVersion.id
    };
    await integrationProcessor()(input);
    await integrationProcessor()(input);

    expect(mocks.attach).toHaveBeenCalledTimes(2);
    expect(mocks.attach).toHaveBeenLastCalledWith(
      expect.objectContaining({
        callback,
        config,
        integrationInstance: integrationInstanceProvider.integrationInstance,
        integrationInstanceProvider
      })
    );
  });

  it('does not attach when the integration provider has no callback', async () => {
    mocks.callbackFindUnique.mockResolvedValue(null);

    await integrationProcessor()({
      integrationInstanceProviderId: integrationInstanceProvider.id
    });

    expect(mocks.attach).not.toHaveBeenCalled();
  });

  it('detaches an existing projection when the instance provider is archived', async () => {
    let callbackInstance = { id: 'callback_instance_1', status: 'attached' };
    mocks.callbackInstanceFindFirst.mockResolvedValue(callbackInstance);

    await integrationProcessor()({
      integrationInstanceProviderId: integrationInstanceProvider.id,
      archived: true
    });

    expect(mocks.detach).toHaveBeenCalledWith(expect.objectContaining({ callbackInstance }));
    expect(mocks.attach).not.toHaveBeenCalled();
  });

  it('fans a newly-created callback out to all configured instance providers', async () => {
    mocks.callbackFindUnique.mockResolvedValue({
      oid: callback.oid,
      integrationProviderOid: callback.integrationProviderOid
    });
    mocks.integrationInstanceProviderFindMany.mockResolvedValueOnce([
      { id: 'integration_instance_provider_1' },
      { id: 'integration_instance_provider_2' }
    ]);

    await fanoutProcessor()({ callbackId: callback.id });

    expect(
      mocks.queues.get('sub/callback/integration/reconcile')!.addMany
    ).toHaveBeenCalledWith([
      { integrationInstanceProviderId: 'integration_instance_provider_1' },
      { integrationInstanceProviderId: 'integration_instance_provider_2' }
    ]);
  });

  it('archives the callback projection when its integration provider is archived', async () => {
    mocks.integrationProviderFindUnique.mockResolvedValue({
      ...integrationInstanceProvider.integrationProvider,
      tenant,
      environment,
      integration: { oid: callback.integrationOid },
      callback,
      currentVersion: integrationInstanceProvider.integrationProvider.currentVersion
    });

    await providerProcessor()({
      integrationProviderId: integrationInstanceProvider.integrationProvider.id,
      archived: true
    });

    expect(mocks.archiveCallback).toHaveBeenCalledWith({
      callback,
      tenant,
      environment
    });
    expect(mocks.queues.get('sub/callback/integration/fanout')!.add).toHaveBeenCalledWith({
      callbackId: callback.id
    });
  });

  it('converges when the instance-version event arrives before provider reconciliation', async () => {
    let nextDeployment = { oid: 40n, id: 'deployment_2' };
    let staleProvider = {
      ...integrationInstanceProvider,
      integrationProvider: {
        ...integrationInstanceProvider.integrationProvider,
        currentVersion: {
          ...integrationInstanceProvider.integrationProvider.currentVersion,
          deploymentOid: nextDeployment.oid,
          deployment: nextDeployment
        }
      }
    };
    mocks.integrationInstanceProviderFindUnique.mockResolvedValue(staleProvider);

    await expect(
      integrationProcessor()({
        integrationInstanceProviderId: integrationInstanceProvider.id
      })
    ).rejects.toThrow();
    expect(
      mocks.queues.get('sub/callback/integration/provider-reconcile')!.add
    ).toHaveBeenCalledWith({
      integrationProviderId: integrationInstanceProvider.integrationProvider.id
    });

    let providerWithCallback = {
      ...staleProvider.integrationProvider,
      tenant,
      environment,
      integrationOid: callback.integrationOid,
      integration: { oid: callback.integrationOid },
      callback
    };
    mocks.integrationProviderFindUnique.mockResolvedValue(providerWithCallback);
    mocks.resolveTriggers.mockResolvedValue([]);
    mocks.tx.callback.update.mockResolvedValue({
      ...callback,
      providerDeploymentOid: nextDeployment.oid,
      providerDeployment: nextDeployment
    });
    await providerProcessor()({
      integrationProviderId: integrationInstanceProvider.integrationProvider.id
    });
    expect(mocks.syncCallback).toHaveBeenCalledWith({ callbackId: callback.id });
  });

  it('re-resolves selected triggers by their stable specification identifier', async () => {
    let nextDeployment = { oid: 40n, id: 'deployment_2' };
    let callbackWithTrigger = {
      ...callback,
      callbackProviderTriggers: [
        {
          providerTrigger: {
            specId: 'version-specific-trigger-id',
            specUniqueIdentifier: 'stable-trigger-id'
          },
          eventTypes: ['event.created']
        }
      ]
    };
    mocks.integrationProviderFindUnique.mockResolvedValue({
      ...integrationInstanceProvider.integrationProvider,
      tenant,
      environment,
      integrationOid: callback.integrationOid,
      integration: { oid: callback.integrationOid },
      currentVersion: {
        ...integrationInstanceProvider.integrationProvider.currentVersion,
        deploymentOid: nextDeployment.oid,
        deployment: nextDeployment
      },
      callback: callbackWithTrigger
    });
    mocks.tx.callback.update.mockResolvedValue({
      ...callbackWithTrigger,
      providerDeploymentOid: nextDeployment.oid
    });

    await providerProcessor()({
      integrationProviderId: integrationInstanceProvider.integrationProvider.id
    });

    expect(mocks.resolveTriggers).toHaveBeenCalledWith(
      expect.objectContaining({
        inputTriggers: [{ triggerId: 'stable-trigger-id', eventTypes: ['event.created'] }]
      })
    );
  });

  it('archives the projection when a selected trigger disappeared', async () => {
    let nextDeployment = { oid: 40n, id: 'deployment_2' };
    mocks.integrationProviderFindUnique.mockResolvedValue({
      ...integrationInstanceProvider.integrationProvider,
      tenant,
      environment,
      integrationOid: callback.integrationOid,
      integration: { oid: callback.integrationOid },
      currentVersion: {
        ...integrationInstanceProvider.integrationProvider.currentVersion,
        deploymentOid: nextDeployment.oid,
        deployment: nextDeployment
      },
      callback
    });
    mocks.resolveTriggers.mockRejectedValue(
      new ServiceError(
        badRequestError({
          code: 'invalid_callback_trigger',
          message: 'Trigger disappeared.'
        })
      )
    );

    await providerProcessor()({
      integrationProviderId: integrationInstanceProvider.integrationProvider.id
    });

    expect(mocks.archiveCallback).toHaveBeenCalledWith({
      callback,
      tenant,
      environment
    });
    expect(mocks.tx.callback.update).not.toHaveBeenCalled();
  });

  it('archives the projection when the next config schema requires a missing key', async () => {
    let nextDeployment = { oid: 40n, id: 'deployment_2' };
    let configuredCallback = {
      ...callback,
      callbackConfig: {
        status: 'active',
        currentVersion: { id: 'callback_config_version_1' }
      }
    };
    mocks.integrationProviderFindUnique.mockResolvedValue({
      ...integrationInstanceProvider.integrationProvider,
      tenant,
      environment,
      integrationOid: callback.integrationOid,
      integration: { oid: callback.integrationOid },
      currentVersion: {
        ...integrationInstanceProvider.integrationProvider.currentVersion,
        deploymentOid: nextDeployment.oid,
        deployment: nextDeployment
      },
      callback: configuredCallback
    });
    mocks.resolveTriggers.mockResolvedValue([
      { providerTrigger: { oid: 50n, specId: 'trigger-1' }, eventTypes: [] }
    ]);
    mocks.getConfigSchema.mockResolvedValue({ schema: { type: 'object' } });
    mocks.tx.callback.update.mockResolvedValue(configuredCallback);
    mocks.setConfig.mockRejectedValue(
      new ServiceError(
        badRequestError({
          code: 'callback_config_incomplete',
          message: 'A newly-required key is missing.'
        })
      )
    );

    await providerProcessor()({
      integrationProviderId: integrationInstanceProvider.integrationProvider.id
    });

    expect(mocks.archiveCallback).toHaveBeenCalledWith({
      callback: configuredCallback,
      tenant,
      environment
    });
  });
});
