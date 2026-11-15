import { beforeEach, describe, expect, it, vi } from 'vitest';

let { findMany, dispatch, nextPage } = vi.hoisted(() => ({
  findMany: vi.fn(),
  dispatch: vi.fn(),
  nextPage: vi.fn()
}));

vi.mock('@metorial/db', () => ({ db: { skillDestinationSync: { findMany } } }));
vi.mock('@metorial/cron', () => ({ createCron: () => ({}) }));
vi.mock('@metorial/queue', () => ({
  createQueue: () => ({ process: (run: unknown) => run, add: nextPage })
}));
vi.mock('./start', () => ({ syncStartQueue: { addManyWithOps: dispatch } }));

import { dispatchPendingSkillSyncsQueueProcessor } from './dispatch';

let run = dispatchPendingSkillSyncsQueueProcessor as unknown as (data: {
  cursor?: string;
}) => Promise<void>;

describe('sync dispatch recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([{ id: 'sync_1' }]);
  });

  it('recovers pending or stalled syncs using the original job identity', async () => {
    await run({});

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { status: 'pending' },
            {
              status: { in: ['processing', 'waiting_for_review'] },
              OR: [
                { updatedAt: { lte: expect.any(Date) } },
                {
                  repositoryPropagations: {
                    some: { status: 'pending', updatedAt: { lte: expect.any(Date) } }
                  }
                }
              ]
            }
          ]
        }),
        select: { id: true },
        take: 500
      })
    );
    expect(dispatch).toHaveBeenCalledWith([
      {
        data: { skillDestinationSyncId: 'sync_1', recover: true },
        opts: { id: 'sync_1' }
      }
    ]);
    expect(nextPage).not.toHaveBeenCalled();
  });

  it('paces continuation only for a full page', async () => {
    findMany.mockResolvedValue(Array.from({ length: 500 }, (_, i) => ({ id: `sync_${i}` })));

    await run({ cursor: 'previous' });

    expect(nextPage).toHaveBeenCalledWith({ cursor: 'sync_499' }, { delay: 1000 });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { gt: 'previous' } })
      })
    );
  });
});
