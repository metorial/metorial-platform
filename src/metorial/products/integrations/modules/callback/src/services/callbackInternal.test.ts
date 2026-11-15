import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  db,
  enqueueCallbackPush,
  enqueueCallbackInstancePush,
  callbackInstanceReconcileManyQueue,
  getBackend
} = vi.hoisted(() => ({
  db: {
    adapterIntegrationProvider: { findMany: vi.fn() },
    callback: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn()
    },
    callbackInstance: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    integrationInstanceProvider: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    integrationProvider: { findUnique: vi.fn() },
    providerConfigVersion: { findUnique: vi.fn() },
    providerVariant: { findUniqueOrThrow: vi.fn() }
  },
  enqueueCallbackPush: vi.fn(),
  enqueueCallbackInstancePush: vi.fn(),
  callbackInstanceReconcileManyQueue: { add: vi.fn() },
  getBackend: vi.fn()
}));

vi.mock('@lowerdeck/lock', () => ({
  createLock: () => ({ usingLock: async (_key: string, cb: () => Promise<any>) => await cb() })
}));

vi.mock('@lowerdeck/service', () => ({
  Service: { create: (_name: string, factory: () => any) => ({ build: factory }) }
}));

vi.mock('@metorial-subspace/db', () => ({
  db,
  getId: () => ({ id: 'callback_new', oid: 900n }),
  withTransaction: async (cb: (db: any) => Promise<any>) => await cb(db)
}));

vi.mock('@metorial-subspace/provider', () => ({ getBackend }));
vi.mock('../env', () => ({ env: { service: { REDIS_URL: 'redis://test' } } }));
vi.mock('../queues/push/callback', () => ({ enqueueCallbackPush }));
vi.mock('../queues/push/callbackInstance', () => ({ enqueueCallbackInstancePush }));
vi.mock('../queues/search/callback', () => ({ indexCallbackQueue: { add: vi.fn() } }));
vi.mock('../queues/reconcile/callback', () => ({
  callbackReconcileForIntegrationManyQueue: { add: vi.fn() },
  callbackReconcileQueue: { add: vi.fn(), addMany: vi.fn() }
}));
vi.mock('../queues/reconcile/callbackInstance', () => ({
  callbackInstanceReconcileForIntegrationInstanceManyQueue: { add: vi.fn() },
  callbackInstanceReconcileManyQueue,
  callbackInstanceReconcileQueue: { add: vi.fn(), addMany: vi.fn() }
}));

import { callbackInternalService } from './callbackInternal';

let integrationProvider = {
  oid: 100n,
  id: 'integrationProvider_1',
  name: 'Slack',
  description: null,
  status: 'active',
  areCallbacksEnabled: true,
  integrationOid: 110n,
  tenantOid: 120n,
  projectOid: 130n,
  environmentOid: 140n,
  instanceOid: 150n,
  solutionOid: 1,
  tenant: { oid: 120n, disableCallbacks: false },
  integration: { status: 'active' },
  provider: {
    oid: 200n,
    type: { attributes: { triggers: { status: 'enabled' } } },
    defaultVariant: { oid: 210n }
  }
};

describe('callbackInternalService ownership reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.integrationProvider.findUnique.mockResolvedValue(integrationProvider);
    db.callback.findMany.mockResolvedValue([]);
    db.callback.findFirst.mockResolvedValue(null);
    db.callback.create.mockImplementation(async ({ data }: any) => data);
    db.callbackInstance.findMany.mockResolvedValue([]);
    db.callbackInstance.create.mockImplementation(async ({ data }: any) => data);
    db.callbackInstance.updateMany.mockResolvedValue({ count: 0 });
    db.providerVariant.findUniqueOrThrow.mockResolvedValue({ oid: 210n });
    getBackend.mockResolvedValue({ callbacks: { deleteCallback: vi.fn() } });
  });

  it('creates only a managed callback for an adapter-owned provider', async () => {
    db.adapterIntegrationProvider.findMany.mockResolvedValue([
      {
        adapterIntegration: {
          adapterGlobal: { oid: 300n, name: 'Chat' }
        }
      }
    ]);

    await callbackInternalService.reconcileCallbackForIntegrationProvider({
      integrationProviderId: integrationProvider.id
    });

    expect(db.callback.create).toHaveBeenCalledTimes(1);
    expect(db.callback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownership: 'managed',
          managedAdapterGlobalOid: 300n
        })
      })
    );
  });

  it('creates a user-owned callback when no adapter owns the provider', async () => {
    db.adapterIntegrationProvider.findMany.mockResolvedValue([]);

    await callbackInternalService.reconcileCallbackForIntegrationProvider({
      integrationProviderId: integrationProvider.id
    });

    expect(db.callback.create).toHaveBeenCalledTimes(1);
    expect(db.callback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownership: 'user',
          managedAdapterGlobalOid: null
        })
      })
    );
  });

  it('archives an existing user-owned callback after an adapter takes ownership', async () => {
    db.adapterIntegrationProvider.findMany.mockResolvedValue([
      {
        adapterIntegration: {
          adapterGlobal: { oid: 300n, name: 'Chat' }
        }
      }
    ]);
    db.callback.findMany.mockResolvedValue([
      {
        oid: 400n,
        id: 'callback_user',
        status: 'active',
        ownership: 'user',
        managedAdapterGlobalOid: null,
        providerVariantOid: 210n
      }
    ]);

    await callbackInternalService.reconcileCallbackForIntegrationProvider({
      integrationProviderId: integrationProvider.id
    });

    expect(db.callback.update).toHaveBeenCalledWith({
      where: { oid: 400n },
      data: { status: 'archived', archivedAt: expect.any(Date) }
    });
  });

  it('persists selections on a user callback before its background push', async () => {
    db.adapterIntegrationProvider.findMany.mockResolvedValue([]);
    let selections = { 'spreadsheet-changes': { spreadsheetId: 'sheet-1' } };

    await callbackInternalService.reconcileCallbackForIntegrationProvider({
      integrationProviderId: integrationProvider.id,
      input: { triggerGroupSelections: selections }
    });

    expect(db.callback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ triggerGroupSelections: selections })
      })
    );
    expect(enqueueCallbackPush).toHaveBeenCalledWith({ callbackId: 'callback_new' });
  });

  it('rejects invalid selections before enabling callbacks or creating records', async () => {
    let beforeReconcile = vi.fn();

    await expect(
      callbackInternalService.reconcileCallbackForIntegrationProvider({
        integrationProviderId: integrationProvider.id,
        input: { triggerGroupSelections: { group: [] } as any },
        beforeReconcile
      })
    ).rejects.toThrow();

    expect(beforeReconcile).not.toHaveBeenCalled();
    expect(db.callback.create).not.toHaveBeenCalled();
  });

  it('snapshots persisted selections on every reconciled callback instance', async () => {
    let selections = { 'spreadsheet-changes': { spreadsheetId: 'sheet-1' } };
    db.callback.findMany.mockResolvedValue([
      { oid: 400n, status: 'active', syncStatus: 'synced', triggerGroupSelections: selections }
    ]);
    db.integrationInstanceProvider.findUnique.mockResolvedValue({
      ...integrationProvider,
      integrationProvider,
      integrationProviderOid: integrationProvider.oid,
      integrationInstanceOid: 500n,
      integrationInstance: { status: 'active', isParentDeleted: false },
      currentVersion: {
        config: { currentVersion: { oid: 600n } },
        authConfig: { currentVersion: { oid: 700n } }
      }
    });

    await callbackInternalService.reconcileCallbackInstanceForIntegrationInstanceProvider({
      integrationInstanceProviderId: 'instance-provider-1'
    });

    expect(db.callbackInstance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        callbackOid: 400n,
        triggerGroupSelections: selections,
        providerConfigVersionOid: 600n,
        providerAuthConfigVersionOid: 700n,
        tenantOid: integrationProvider.tenantOid
      })
    });
  });
});

describe('callbackInternalService selection generations', () => {
  let narrowed = { folders: { ids: ['a'] } };
  let callback = {
    oid: 400n,
    status: 'active',
    syncStatus: 'synced',
    providerVariantOid: 210n,
    integrationProviderOid: integrationProvider.oid,
    triggerGroupSelections: narrowed
  };
  let integrationInstanceProvider = {
    ...integrationProvider,
    id: 'instance-provider-1',
    oid: 800n,
    integrationProvider,
    integrationProviderOid: integrationProvider.oid,
    integrationInstanceOid: 500n,
    integrationInstance: { status: 'active', isParentDeleted: false },
    currentVersion: {
      config: { currentVersion: { oid: 600n } },
      authConfig: null
    }
  };
  let generation = (
    oid: bigint,
    generationStatus: 'provisioning' | 'primary' | 'replaced',
    triggerGroupSelections: Record<string, Record<string, any>>
  ) => ({
    oid,
    id: `callbackInstance_${oid}`,
    status: 'active',
    syncStatus: 'synced',
    generationStatus,
    triggerGroupSelections,
    callbackOid: callback.oid,
    integrationInstanceProviderOid: integrationInstanceProvider.oid,
    providerConfigVersionOid: 600n,
    providerAuthConfigVersionOid: null,
    callback
  });
  let archivedOids = () =>
    db.callbackInstance.update.mock.calls
      .filter(([args]: any) => args.data.status === 'archived')
      .map(([args]: any) => args.where.oid);
  let reconcile = () =>
    callbackInternalService.reconcileCallbackInstanceForIntegrationInstanceProvider({
      integrationInstanceProviderId: integrationInstanceProvider.id
    });

  let serving = generation(1n, 'primary', { folders: { ids: ['a', 'b'] } });
  let abandoned = generation(2n, 'provisioning', { folders: { ids: ['c'] } });
  let overtaken = generation(3n, 'replaced', { folders: { ids: ['d'] } });
  let replacement = generation(4n, 'provisioning', narrowed);

  let backend = { createCallbackInstance: vi.fn(), deleteCallbackInstance: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    db.integrationProvider.findUnique.mockResolvedValue(integrationProvider);
    db.integrationInstanceProvider.findUnique.mockResolvedValue(integrationInstanceProvider);
    db.integrationInstanceProvider.findUniqueOrThrow.mockResolvedValue(
      integrationInstanceProvider
    );
    db.callback.findMany.mockResolvedValue([callback]);
    db.callback.findUniqueOrThrow.mockResolvedValue(callback);
    db.callbackInstance.create.mockImplementation(async ({ data }: any) => data);
    db.callbackInstance.update.mockImplementation(async ({ data }: any) => data);
    db.callbackInstance.updateMany.mockResolvedValue({ count: 0 });
    db.providerConfigVersion.findUnique.mockResolvedValue({ oid: 600n });
    db.providerVariant.findUniqueOrThrow.mockResolvedValue({ oid: 210n });
    backend.deleteCallbackInstance.mockResolvedValue({});
    getBackend.mockResolvedValue({ callbacks: backend });
  });

  it('archives superseded generations but keeps the serving one until it is replaced', async () => {
    db.callbackInstance.findMany.mockResolvedValue([
      serving,
      abandoned,
      overtaken,
      replacement
    ]);

    await reconcile();

    expect(archivedOids()).toEqual([abandoned.oid, overtaken.oid]);
    expect(backend.deleteCallbackInstance).toHaveBeenCalledTimes(2);
    expect(enqueueCallbackInstancePush).toHaveBeenCalledWith({
      callbackInstanceId: replacement.id
    });
    expect(db.callbackInstance.create).not.toHaveBeenCalled();
  });

  it('keeps a replaced generation while nothing else is serving', async () => {
    db.callbackInstance.findMany.mockResolvedValue([abandoned, overtaken]);

    await reconcile();

    expect(archivedOids()).toEqual([abandoned.oid]);
    expect(db.callbackInstance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ triggerGroupSelections: narrowed })
    });
  });

  it('archives every other generation once the primary matches', async () => {
    db.callbackInstance.findMany.mockResolvedValue([
      abandoned,
      overtaken,
      generation(5n, 'primary', narrowed)
    ]);

    await reconcile();

    expect(archivedOids()).toEqual([abandoned.oid, overtaken.oid]);
  });

  it('reports a failed re-registration on the serving generation', async () => {
    db.callbackInstance.findUnique.mockResolvedValue({
      ...replacement,
      integrationInstanceProvider: { id: integrationInstanceProvider.id }
    });
    backend.createCallbackInstance.mockRejectedValue(new Error('hub unavailable'));

    await callbackInternalService.pushCallbackInstanceById({
      callbackInstanceId: replacement.id
    });

    let failed = {
      syncStatus: 'failed',
      lastSyncErrorCode: 'callback_sync_failed',
      lastSyncErrorMessage: 'hub unavailable'
    };
    expect(db.callbackInstance.updateMany).toHaveBeenCalledWith({
      where: {
        integrationInstanceProviderOid: integrationInstanceProvider.oid,
        callbackOid: callback.oid,
        status: 'active',
        generationStatus: 'primary',
        oid: { not: replacement.oid }
      },
      data: failed
    });
    expect(db.callbackInstance.update).toHaveBeenCalledWith({
      where: { oid: replacement.oid },
      data: failed
    });
  });
});
