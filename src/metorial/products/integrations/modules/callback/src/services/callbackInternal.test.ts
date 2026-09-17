import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, enqueueCallbackPush, callbackInstanceReconcileManyQueue, getBackend } = vi.hoisted(
  () => ({
    db: {
      adapterIntegrationProvider: { findMany: vi.fn() },
      callback: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn()
      },
      callbackInstance: { findMany: vi.fn(), updateMany: vi.fn() },
      integrationProvider: { findUnique: vi.fn() },
      providerVariant: { findUniqueOrThrow: vi.fn() }
    },
    enqueueCallbackPush: vi.fn(),
    callbackInstanceReconcileManyQueue: { add: vi.fn() },
    getBackend: vi.fn()
  })
);

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
vi.mock('../queues/push/callbackInstance', () => ({ enqueueCallbackInstancePush: vi.fn() }));
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
});
