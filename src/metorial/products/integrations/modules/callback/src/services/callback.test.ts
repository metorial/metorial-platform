import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, fire, callbackInstanceReconcileManyQueue, indexCallbackQueue } = vi.hoisted(() => ({
  db: { callback: { update: vi.fn() } },
  fire: vi.fn(),
  callbackInstanceReconcileManyQueue: { add: vi.fn() },
  indexCallbackQueue: { add: vi.fn() }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: { create: (_name: string, factory: () => unknown) => ({ build: factory }) }
}));
vi.mock('@lowerdeck/pagination', () => ({ Paginator: {} }));
vi.mock('@metorial-subspace/db', () => ({ db, Prisma: { DbNull: null } }));
vi.mock('@metorial-subspace/list-utils', () => ({}));
vi.mock('@metorial-subspace/module-search', () => ({}));
vi.mock('@metorial-subspace/module-tenant', () => ({
  resolveMetorialFacing: async () => ({ tenant: { oid: 1n }, environment: { oid: 2n } }),
  toProviderEventBase: (d: any) => ({ instance: d.instance, auditScope: d.auditScope })
}));
vi.mock('@metorial-subspace/provider', () => ({ getBackend: vi.fn() }));
vi.mock('@metorial/fabric', () => ({ Fabric: { fire } }));
vi.mock('../queues/reconcile/callbackInstance', () => ({
  callbackInstanceReconcileManyQueue
}));
vi.mock('../queues/search/callback', () => ({ indexCallbackQueue }));

import { callbackService } from './callback';

let stored = { folder_events: { folderIds: ['a', 'b'] }, renamed: { ids: ['x'] } };

let callback = {
  oid: 400n,
  id: 'callback_1',
  status: 'active',
  ownership: 'user',
  name: 'Drive',
  description: null,
  triggerGroupSelections: stored,
  callbackInstances: [
    {
      selectableTriggerGroups: [
        {
          key: 'folder_events',
          name: 'Folder events',
          description: null,
          status: 'active',
          selectionSchema: {
            type: 'object',
            required: ['folderIds'],
            properties: { folderIds: { type: 'array', items: { type: 'string' } } }
          }
        }
      ]
    }
  ],
  integration: { id: 'integration_1' },
  integrationProvider: { id: 'integrationProvider_1' },
  provider: { id: 'provider_1', name: 'Google Drive' }
} as any;

let update = (triggerGroupSelections?: Record<string, Record<string, any>> | null) =>
  callbackService.updateCallback({
    instance: { oid: 3n } as any,
    callback,
    input: { triggerGroupSelections }
  });

let reconcile = { integrationProviderId: 'integrationProvider_1' };

describe('callbackService.updateCallback trigger group selections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.callback.update.mockImplementation(async ({ data }: any) => ({
      ...callback,
      ...('triggerGroupSelections' in data
        ? { triggerGroupSelections: data.triggerGroupSelections }
        : {})
    }));
  });

  it('saves around a stored selection whose trigger group is no longer known', async () => {
    let next = { folder_events: { folderIds: ['a'] }, renamed: { ids: ['x'] } };

    await expect(update(next)).resolves.toMatchObject({ triggerGroupSelections: next });
    await expect(update({ folder_events: { folderIds: ['a'] } })).resolves.toMatchObject({
      triggerGroupSelections: { folder_events: { folderIds: ['a'] } }
    });
  });

  it('rejects a new or edited selection for an unknown trigger group', async () => {
    await expect(update({ ...stored, renamed: { ids: ['y'] } })).rejects.toThrow(
      'Unknown trigger group: renamed'
    );
    await expect(update({ ...stored, mistyped: {} })).rejects.toThrow(
      'Unknown trigger group: mistyped'
    );

    expect(db.callback.update).not.toHaveBeenCalled();
    expect(callbackInstanceReconcileManyQueue.add).not.toHaveBeenCalled();
  });

  it('enqueues the reconcile for every save that carries selections', async () => {
    await update(stored);

    expect(db.callback.update.mock.calls[0]![0].data).not.toHaveProperty(
      'triggerGroupSelections'
    );
    expect(callbackInstanceReconcileManyQueue.add).toHaveBeenCalledWith(reconcile);

    await update({ folder_events: { folderIds: ['a'] } });

    expect(callbackInstanceReconcileManyQueue.add).toHaveBeenCalledTimes(2);
  });

  it('still enqueues the reconcile when indexing fails', async () => {
    indexCallbackQueue.add.mockRejectedValueOnce(new Error('redis unavailable'));

    await expect(update(null)).rejects.toThrow('redis unavailable');

    expect(callbackInstanceReconcileManyQueue.add).toHaveBeenCalledWith(reconcile);
  });

  it('leaves instances alone when the selections are not part of the update', async () => {
    await update(undefined);

    expect(callbackInstanceReconcileManyQueue.add).not.toHaveBeenCalled();
  });

  it('reports the changed trigger group keys on the update event, not their values', async () => {
    await update({ folder_events: { folderIds: ['secret-folder'] } });
    await update(stored);

    let events = fire.mock.calls.filter(
      ([name]) => name === 'provider.callback.updated:after'
    );
    expect(events.map(([, event]) => event.changedTriggerGroupKeys)).toEqual([
      ['folder_events', 'renamed'],
      []
    ]);
    expect(JSON.stringify(events.map(([, event]) => event.callback))).not.toContain(
      'secret-folder'
    );
  });
});
