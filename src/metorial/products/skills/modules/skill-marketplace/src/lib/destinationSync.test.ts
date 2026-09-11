import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, add } = vi.hoisted(() => ({
  db: {
    skillMarketplace: { update: vi.fn() },
    skillDestination: { update: vi.fn() },
    skillDestinationSync: { create: vi.fn() }
  },
  add: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db,
  ID: { generateId: vi.fn(async () => 'skillDestinationSync_1') },
  withTransaction: vi.fn(async (callback: (tx: typeof db) => unknown) => await callback(db))
}));

vi.mock('../queues/sync/start', () => ({
  syncStartQueue: { add }
}));

import { forceSkillDestinationSync } from './destinationSync';

describe('forceSkillDestinationSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.skillDestinationSync.create.mockResolvedValue({ id: 'skillDestinationSync_1' });
  });

  it('increments the marketplace force counter before enqueueing its sync', async () => {
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
    expect(add).toHaveBeenCalledWith({
      skillDestinationSyncId: 'skillDestinationSync_1',
      skillRepositoryId: undefined
    });
  });
});
