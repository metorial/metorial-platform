import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, add, hooks } = vi.hoisted(() => ({
  db: {
    skillMarketplace: { update: vi.fn() },
    skillDestination: { update: vi.fn() },
    skillDestinationSync: { create: vi.fn() }
  },
  add: vi.fn(),
  hooks: [] as (() => Promise<void>)[]
}));

vi.mock('@metorial/db', () => ({
  db,
  ID: { generateId: vi.fn(async () => 'skillDestinationSync_1') },
  withTransaction: vi.fn(async (callback: (tx: typeof db) => unknown) => await callback(db)),
  addAfterTransactionHook: vi.fn((hook: () => Promise<void>) => hooks.push(hook))
}));

vi.mock('../queues/sync/start', () => ({ syncStartQueue: { add } }));

import { forceSkillDestinationSync } from './destinationSync';

describe('forceSkillDestinationSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hooks.length = 0;
    db.skillDestinationSync.create.mockResolvedValue({ id: 'skillDestinationSync_1' });
  });

  it('persists the force counter and sync intent before dispatching after commit', async () => {
    await forceSkillDestinationSync({
      destination: { oid: 10n },
      incrementForceSyncCounterFor: { oid: 20n }
    });

    expect(db.skillMarketplace.update).toHaveBeenCalledWith({
      where: { oid: 20n },
      data: { forceSyncCounter: { increment: 1 } }
    });
    expect(db.skillDestinationSync.create).toHaveBeenCalledWith({
      data: {
        id: 'skillDestinationSync_1',
        destinationOid: 10n,
        status: 'pending'
      }
    });
    expect(add).not.toHaveBeenCalled();

    await hooks[0]!();

    expect(add).toHaveBeenCalledWith(
      { skillDestinationSyncId: 'skillDestinationSync_1' },
      { id: 'skillDestinationSync_1' }
    );
  });

  it('records why the sync was forced and whether it may delete unexpected files', async () => {
    await forceSkillDestinationSync({
      destination: { oid: 10n },
      trigger: 'manual',
      allowMassDelete: true
    });

    expect(db.skillDestinationSync.create).toHaveBeenCalledWith({
      data: {
        id: 'skillDestinationSync_1',
        destinationOid: 10n,
        status: 'pending',
        trigger: 'manual',
        allowMassDelete: true
      }
    });
  });

  it('leaves a durable pending sync when post-commit dispatch fails', async () => {
    await forceSkillDestinationSync({ destination: { oid: 10n } });
    add.mockRejectedValueOnce(new Error('Redis unavailable'));

    await expect(hooks[0]!()).rejects.toThrow('Redis unavailable');

    expect(db.skillDestinationSync.create).toHaveBeenCalledOnce();
  });

  it('does not schedule work when persisting the sync fails', async () => {
    db.skillDestinationSync.create.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(forceSkillDestinationSync({ destination: { oid: 10n } })).rejects.toThrow();

    expect(hooks).toHaveLength(0);
    expect(add).not.toHaveBeenCalled();
  });
});
