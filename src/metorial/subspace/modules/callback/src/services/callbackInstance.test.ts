import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  callbackInstanceFindFirst: vi.fn(),
  callbackInstanceFindUnique: vi.fn(),
  callbackInstanceFindUniqueOrThrow: vi.fn(),
  callbackInstanceCreate: vi.fn(),
  callbackInstanceUpdateMany: vi.fn(),
  getCombinations: vi.fn(),
  upsertPair: vi.fn(),
  syncCallbackInstance: vi.fn(),
  enqueueReconcile: vi.fn(),
  createPathSecret: vi.fn(),
  rotatePathSecret: vi.fn(),
  registrationGet: vi.fn(),
  applyMirror: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({ build: () => factory() }))
  }
}));

vi.mock('@lowerdeck/pagination', () => ({ Paginator: { create: vi.fn() } }));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    callbackInstance: {
      findFirst: mocks.callbackInstanceFindFirst,
      findUnique: mocks.callbackInstanceFindUnique,
      findUniqueOrThrow: mocks.callbackInstanceFindUniqueOrThrow,
      create: mocks.callbackInstanceCreate,
      updateMany: mocks.callbackInstanceUpdateMany
    },
    integrationInstanceProvider: {
      findMany: vi.fn()
    }
  },
  Prisma: { DbNull: null },
  getId: () => ({ oid: 100n, id: 'callback_instance_generated' }),
  withTransaction: vi.fn()
}));

vi.mock('@metorial-subspace/list-utils', () => ({
  normalizeDateFilter: vi.fn(),
  normalizeStatusForList: () => ({ onlyParent: {} }),
  resolveCallbacks: vi.fn(),
  resolveProviderAuthConfigs: vi.fn(),
  resolveProviderConfigs: vi.fn()
}));

vi.mock('@metorial-subspace/module-provider-internal', () => ({
  providerCombinationService: { getCombinationsInternal: mocks.getCombinations },
  providerDeploymentConfigPairInternalService: {
    upsertDeploymentConfigPair: mocks.upsertPair
  }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  getMetorialSolution: vi.fn(),
  resolveMetorialFacing: async () => ({
    tenant: { oid: 1n, id: 'tenant_1' },
    environment: { oid: 2n, id: 'environment_1' }
  }),
  toProviderEventBase: vi.fn()
}));

vi.mock('@metorial/fabric', () => ({ Fabric: { fire: vi.fn() } }));

vi.mock('@metorial-subspace/provider-slates/src/client', () => ({
  getTenantForSlates: async () => ({ id: 'hub_tenant_1' }),
  slates: {
    callbackRegistration: {
      createPathSecret: mocks.createPathSecret,
      rotatePathSecret: mocks.rotatePathSecret,
      get: mocks.registrationGet
    }
  }
}));

vi.mock('@metorial-subspace/module-auth', () => ({
  tombstoneProvisionedTenantAppsForCallbackInTransaction: vi.fn()
}));

vi.mock('../reconciler/lib/sync', () => ({
  applyCallbackRegistrationMirror: mocks.applyMirror
}));

vi.mock('./callback', () => ({ callbackService: {} }));

vi.mock('./callbackRegistration', () => ({
  callbackRegistrationService: {
    syncCallbackInstance: mocks.syncCallbackInstance,
    enqueueReconcile: mocks.enqueueReconcile,
    detachRegistration: vi.fn()
  }
}));

import { callbackInstanceService } from './callbackInstance';

let callback = {
  oid: 4n,
  id: 'callback_1',
  integrationOid: 3n,
  integrationProviderOid: 2n,
  status: 'active',
  providerDeployment: {
    oid: 5n,
    id: 'deployment_1',
    status: 'active',
    currentVersion: { oid: 6n }
  }
} as any;
let config = { oid: 7n, id: 'config_1' } as any;
let pair = { oid: 8n, id: 'pair_1' } as any;
let integrationInstance = {
  oid: 10n,
  id: 'integration_instance_1',
  integrationOid: callback.integrationOid
} as any;
let integrationInstanceProvider = {
  oid: 11n,
  id: 'integration_instance_provider_1',
  integrationOid: callback.integrationOid,
  integrationInstanceOid: integrationInstance.oid,
  integrationProviderOid: callback.integrationProviderOid
} as any;
let callbackInstance = {
  oid: 9n,
  id: 'callback_instance_1',
  callbackOid: callback.oid,
  integrationInstanceOid: integrationInstance.oid,
  integrationInstanceProviderOid: integrationInstanceProvider.oid,
  providerDeploymentConfigPairOid: pair.oid,
  status: 'attached',
  slateTriggerReceiverId: 'receiver_1',
  registrationReceiverAuthorityVersion: 4,
  updatedAt: new Date('2026-08-21T12:00:00.000Z')
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCombinations.mockResolvedValue([{ config, authConfig: null }]);
  mocks.upsertPair.mockResolvedValue({ pair });
  mocks.callbackInstanceCreate.mockResolvedValue(callbackInstance);
  mocks.callbackInstanceUpdateMany.mockResolvedValue({ count: 1 });
  mocks.callbackInstanceFindUniqueOrThrow.mockResolvedValue(callbackInstance);
  mocks.callbackInstanceFindFirst.mockResolvedValue(callbackInstance);
  mocks.callbackInstanceFindUnique.mockResolvedValue(callbackInstance);
  mocks.syncCallbackInstance.mockResolvedValue(undefined);
  mocks.applyMirror.mockResolvedValue('applied');
  mocks.registrationGet.mockResolvedValue({
    id: 'receiver_1',
    callbackOwnerVersion: 4,
    receiverWebhookUrl: 'https://hub.test/receiver_1',
    receiverPathSecret: {
      id: 'path_1',
      generation: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    triggers: []
  });
  mocks.createPathSecret.mockResolvedValue({
    pathSecret: { id: 'path_1', generation: 1 },
    plaintext: 'metorial_whpath_secret'
  });
});

describe('callback instance attachment', () => {
  it('uses the canonical pair identity and preserves receiver ownership on reattach', async () => {
    mocks.callbackInstanceFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(callbackInstance);
    await callbackInstanceService.attachInternal({
      tenant: { oid: 1n },
      environment: { oid: 2n },
      callback,
      config,
      integrationInstance,
      integrationInstanceProvider
    } as any);
    await callbackInstanceService.attachInternal({
      tenant: { oid: 1n },
      environment: { oid: 2n },
      callback,
      config,
      integrationInstance,
      integrationInstanceProvider
    } as any);

    expect(mocks.callbackInstanceCreate).toHaveBeenCalledTimes(1);
    expect(mocks.callbackInstanceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        callbackOid: callback.oid,
        integrationInstanceOid: integrationInstance.oid,
        integrationInstanceProviderOid: integrationInstanceProvider.oid,
        providerDeploymentConfigPairOid: pair.oid,
        status: 'attached'
      }),
      include: expect.any(Object)
    });
    expect(mocks.syncCallbackInstance).toHaveBeenCalledWith({
      callbackInstanceId: callbackInstance.id
    });
  });

  it('rejects an integration instance provider owned by a different integration provider', async () => {
    await expect(
      callbackInstanceService.attachInternal({
        tenant: { oid: 1n },
        environment: { oid: 2n },
        callback,
        config,
        integrationInstance,
        integrationInstanceProvider: {
          ...integrationInstanceProvider,
          integrationProviderOid: 999n
        }
      } as any)
    ).rejects.toThrow('does not belong to the callback integration provider');

    expect(mocks.callbackInstanceCreate).not.toHaveBeenCalled();
  });

  it('detaches and reattaches the same row when the resolved pair changes', async () => {
    let nextPair = { oid: 80n, id: 'pair_2' };
    mocks.upsertPair.mockResolvedValue({ pair: nextPair });
    let detach = vi
      .spyOn(callbackInstanceService, 'detachInternal')
      .mockResolvedValue({ ...callbackInstance, status: 'detached' } as any);
    mocks.callbackInstanceFindUnique
      .mockResolvedValueOnce(callbackInstance)
      .mockResolvedValueOnce({ ...callbackInstance, status: 'detached' });

    let result = await callbackInstanceService.attachInternal({
      tenant: { oid: 1n },
      environment: { oid: 2n },
      callback,
      config,
      integrationInstance,
      integrationInstanceProvider
    } as any);

    expect(detach).toHaveBeenCalledWith(expect.objectContaining({ callbackInstance }));
    expect(mocks.callbackInstanceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'attached',
          providerDeploymentConfigPairOid: nextPair.oid,
          slateTriggerReceiverId: null,
          registrationStatus: 'pending'
        })
      })
    );
    expect(result.id).toBe(callbackInstance.id);
  });

  it('retries instead of overwriting receiver ownership after a concurrent transition', async () => {
    mocks.callbackInstanceFindUnique.mockResolvedValue({
      ...callbackInstance,
      status: 'detached'
    });
    mocks.callbackInstanceUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      callbackInstanceService.attachInternal({
        tenant: { oid: 1n },
        environment: { oid: 2n },
        callback,
        config,
        integrationInstance,
        integrationInstanceProvider
      } as any)
    ).rejects.toMatchObject({
      data: { code: 'callback_instance_attach_conflict' }
    });

    expect(mocks.syncCallbackInstance).not.toHaveBeenCalled();
  });
});

describe('receiver path secrets', () => {
  it('creates a one-time path secret through the owner-scoped I3 RPC', async () => {
    let result = await callbackInstanceService.createReceiverPathSecret({
      instance: { id: 'instance_1' },
      callback,
      callbackInstance
    } as any);

    expect(mocks.createPathSecret).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'hub_tenant_1',
        callbackId: callback.id,
        callbackInstanceId: callbackInstance.id,
        slateTriggerReceiverId: 'receiver_1',
        expectedOwnerVersion: 4,
        ownerMutationId: expect.stringMatching(/^create-receiver-path:/)
      })
    );
    expect(result).toMatchObject({
      pathSecret: { id: 'path_1', generation: 1 },
      plaintext: 'metorial_whpath_secret',
      webhookUrl: 'https://hub.test/receiver_1/metorial_whpath_secret'
    });
    expect(mocks.applyMirror).toHaveBeenCalledTimes(1);
  });

  it('rejects secret mutation after detachment', async () => {
    await expect(
      callbackInstanceService.createReceiverPathSecret({
        instance: { id: 'instance_1' },
        callback,
        callbackInstance: { ...callbackInstance, status: 'detached' }
      } as any)
    ).rejects.toThrow('does not have an active receiver');
    expect(mocks.createPathSecret).not.toHaveBeenCalled();
  });
});
