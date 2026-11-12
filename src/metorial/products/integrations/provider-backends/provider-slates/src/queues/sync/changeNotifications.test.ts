import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, slates, queues, crons } = vi.hoisted(() => ({
  db: {
    backend: { findFirst: vi.fn() },
    slatesSyncChangeNotificationCursor: { upsert: vi.fn() }
  },
  slates: { changeNotification: { list: vi.fn() }, slate: { list: vi.fn() } },
  queues: {} as Record<
    string,
    {
      add: ReturnType<typeof vi.fn>;
      addManyWithOps: ReturnType<typeof vi.fn>;
      run?: (data: any) => Promise<void>;
    }
  >,
  crons: {} as Record<string, () => Promise<void>>
}));

vi.mock('@lowerdeck/queue', () => ({
  QueueRetryError: class extends Error {},
  createQueue: (opts: { name: string }) => {
    let queue = {
      add: vi.fn(),
      addManyWithOps: vi.fn(),
      process: (run: (data: any) => Promise<void>) => {
        queues[opts.name]!.run = run;
        return {};
      }
    };
    queues[opts.name] = queue;
    return queue;
  }
}));
vi.mock('@lowerdeck/cron', () => ({
  createCron: (opts: { name: string }, run: () => Promise<void>) => {
    crons[opts.name] = run;
    return {};
  }
}));
vi.mock('@lowerdeck/lock', () => ({
  createLock: () => ({ usingLock: (_key: string, run: () => Promise<void>) => run() })
}));
vi.mock('@metorial-subspace/db', () => ({ db }));
vi.mock('../../backend', () => ({ backend: { id: 'kbe_1' } }));
vi.mock('../../client', () => ({ slates }));
vi.mock('../../env', () => ({ env: { service: { REDIS_URL: 'redis://localhost' } } }));
vi.mock('./syncSlateVersion', () => ({
  syncSlateVersionQueue: { addManyWithOps: vi.fn() }
}));
vi.mock('./authConfigEvents', () => ({ syncAuthConfigEventsQueue: { add: vi.fn() } }));
vi.mock('./oauthSetups', () => ({ syncOAuthSetupsQueue: { add: vi.fn() } }));

await import('./cron');
let { syncSlateVersionQueue } = await import('./syncSlateVersion');

let versionSyncs = vi.mocked(syncSlateVersionQueue.addManyWithOps);

describe('slate version sync scheduling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.backend.findFirst.mockResolvedValue({
      oid: 1n,
      id: 'kbe_1',
      slatesSyncChangeNotificationCursor: { cursor: 'shcn_0' }
    });
  });

  // A job that ran out of retries stays in the queue under its id. With a fixed id every
  // later run was dropped as a duplicate, so new versions only arrived with the hourly sync.
  it('schedules the change notification run without a fixed job id', async () => {
    await crons['sub/slt/cnhnotif/cron']!();

    expect(queues['sub/slt/cnhnotif']!.add).toHaveBeenCalledWith(
      {},
      { deduplication: { id: 'kbe_1' } }
    );
  });

  it('syncs each notified version, deduplicated by version', async () => {
    slates.changeNotification.list.mockResolvedValue({
      items: [
        { id: 'shcn_1', slateId: 'shsl_1', slateVersionId: 'shslv_1' },
        { id: 'shcn_2', slateId: 'shsl_2', slateVersionId: null },
        { id: 'shcn_3', slateId: 'shsl_3', slateVersionId: 'shslv_3' }
      ]
    });

    await queues['sub/slt/cnhnotif']!.run!({});

    expect(slates.changeNotification.list).toHaveBeenCalledWith({
      limit: 100,
      after: 'shcn_0',
      order: 'asc'
    });
    expect(versionSyncs).toHaveBeenCalledWith([
      {
        data: { slateId: 'shsl_1', slateVersionId: 'shslv_1' },
        opts: { deduplication: { id: 'shslv_1' } }
      },
      {
        data: { slateId: 'shsl_3', slateVersionId: 'shslv_3' },
        opts: { deduplication: { id: 'shslv_3' } }
      }
    ]);
    expect(db.slatesSyncChangeNotificationCursor.upsert).toHaveBeenCalledWith({
      where: { backendOid: 1n },
      create: { backendOid: 1n, cursor: 'shcn_3' },
      update: { cursor: 'shcn_3' }
    });
  });

  it('re-syncs the current version of every slate on the full sync', async () => {
    slates.slate.list.mockResolvedValue({
      items: [
        { id: 'shsl_1', currentVersion: { id: 'shslv_1' } },
        { id: 'shsl_2', currentVersion: null }
      ]
    });

    await queues['sub/slt/sync/many']!.run!({});

    expect(versionSyncs).toHaveBeenCalledWith([
      {
        data: { slateId: 'shsl_1', slateVersionId: 'shslv_1' },
        opts: { deduplication: { id: 'shslv_1' } }
      }
    ]);
    expect(queues['sub/slt/sync/many']!.add).toHaveBeenCalledWith(
      { cursor: 'shsl_2' },
      { delay: 60 * 1000 }
    );
  });
});
