import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, enqueue, state, transaction } = vi.hoisted(() => {
  let state = { dirty: true, pending: false };
  let db = {
    skillDestination: { updateManyAndReturn: vi.fn(), updateMany: vi.fn() },
    skillDestinationSync: { create: vi.fn() }
  };
  let transaction = vi.fn(async (run: (tx: typeof db) => unknown) => {
    let previous = { ...state };
    try {
      return await run(db);
    } catch (error) {
      Object.assign(state, previous);
      throw error;
    }
  });

  return { db, enqueue: vi.fn(), state, transaction };
});

vi.mock('@metorial/db', () => ({
  db,
  withTransaction: transaction,
  ID: { generateId: async () => 'sync_1' }
}));
vi.mock('@metorial/cron', () => ({ createCron: () => ({}) }));
vi.mock('@metorial/queue', () => ({
  createQueue: () => ({ process: (run: unknown) => run })
}));
vi.mock('../sync/start', () => ({ syncStartQueue: { add: enqueue } }));

import { collectDirtySkillDestinationsSingleQueueProcessor } from './collect';
import { flushDirtySkillDestinationsSingleQueueProcessor } from './flush';

let collect = collectDirtySkillDestinationsSingleQueueProcessor as unknown as (data: {
  destinationId: string;
}) => Promise<void>;

let flush = flushDirtySkillDestinationsSingleQueueProcessor as unknown as (data: {
  destinationId: string;
}) => Promise<void>;

describe('dirty destination scheduling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(state, { dirty: true, pending: false });
    db.skillDestination.updateManyAndReturn.mockImplementation(async () => {
      state.dirty = false;
      return [{ id: 'destination_1', oid: 10n, lastTransientChangeAt: new Date(0) }];
    });
    db.skillDestination.updateMany.mockResolvedValue({ count: 1 });
    db.skillDestinationSync.create.mockImplementation(async () => {
      state.pending = true;
      return { id: 'sync_1' };
    });
    enqueue.mockResolvedValue(undefined);
  });

  it('rolls back clearing dirty state if recording the debounce deadline fails', async () => {
    db.skillDestination.updateMany.mockRejectedValueOnce(new Error('write failed'));

    await expect(collect({ destinationId: 'destination_1' })).rejects.toThrow('write failed');

    expect(transaction).toHaveBeenCalledOnce();
    expect(state.dirty).toBe(true);
  });

  it('preserves the maximum wait deadline when collecting repeated edits', async () => {
    let mustFlushAt = new Date(3_600_000);
    db.skillDestination.updateManyAndReturn.mockResolvedValueOnce([
      { id: 'destination_1', lastTransientChangeAt: new Date(600_000), mustFlushAt }
    ]);

    await collect({ destinationId: 'destination_1' });

    expect(db.skillDestination.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mustFlushAt, shouldFlushAt: new Date(900_000) })
      })
    );
  });

  it('does not postpone initial repository repair on every scan', async () => {
    let shouldFlushAt = new Date(300_000);
    db.skillDestination.updateManyAndReturn.mockResolvedValueOnce([
      { id: 'destination_1', lastTransientChangeAt: null, shouldFlushAt }
    ]);

    await collect({ destinationId: 'destination_1' });

    expect(db.skillDestination.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ shouldFlushAt }) })
    );
  });

  it('rolls back clearing the flush request if creating its sync fails', async () => {
    db.skillDestinationSync.create.mockRejectedValueOnce(new Error('insert failed'));

    await expect(flush({ destinationId: 'destination_1' })).rejects.toThrow('insert failed');

    expect(state.dirty).toBe(true);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('keeps a recoverable pending sync if publishing to Redis fails', async () => {
    enqueue.mockRejectedValueOnce(new Error('Redis unavailable'));

    await expect(flush({ destinationId: 'destination_1' })).rejects.toThrow(
      'Redis unavailable'
    );

    expect(state.pending).toBe(true);
    expect(enqueue).toHaveBeenCalledWith(
      { skillDestinationSyncId: 'sync_1' },
      { id: 'sync_1' }
    );
  });

  it('ignores a destination another flusher has claimed', async () => {
    db.skillDestination.updateManyAndReturn.mockResolvedValueOnce([]);

    await flush({ destinationId: 'destination_1' });

    expect(db.skillDestinationSync.create).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });
});
