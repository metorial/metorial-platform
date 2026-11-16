import { subDays } from 'date-fns';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let h = vi.hoisted(() => ({
  queues: {} as Record<string, { add: ReturnType<typeof vi.fn> }>,
  crons: [] as (() => Promise<void>)[],
  remoteState: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn()
  },
  storage: { listObjectsPage: vi.fn(), deleteObjects: vi.fn() }
}));

vi.mock('../../db', () => ({ db: { scmRepositoryRemoteState: h.remoteState } }));
vi.mock('../../env', () => ({
  env: {
    service: { REDIS_URL: 'redis://unused' },
    storage: { CODE_BUCKET_OBJECT_STORAGE_BUCKET: 'code-bucket' }
  }
}));
vi.mock('../../storage', () => ({ storage: h.storage }));
vi.mock('@lowerdeck/service', () => ({
  Service: { create: (_name: string, factory: () => unknown) => ({ build: factory }) }
}));
vi.mock('@lowerdeck/cron', () => ({
  createCron: (_opts: unknown, run: () => Promise<void>) => {
    h.crons.push(run);
    return run;
  }
}));
vi.mock('@lowerdeck/queue', () => ({
  createQueue: ({ name }: { name: string }) => {
    let queue = { add: vi.fn(), process: (run: unknown) => run };
    h.queues[name] = queue;
    return queue;
  },
  combineQueueProcessors: (processors: unknown[]) => processors
}));

import {
  getRemoteStateKeyPrefix,
  repositoryRemoteStateService
} from '../../services/repositoryRemoteState';
import { remoteStateGcProcessor } from './remoteStateGc';

let [gcCron, gcMany, gcSingle] = remoteStateGcProcessor as unknown as [
  () => Promise<void>,
  (data: { continuationToken?: string }) => Promise<void>,
  (data: { objects: { key: string; lastModified: string }[] }) => Promise<void>
];

let sync = { repoOid: 10n, sourceKey: 'marketplace:1', branchName: 'metorial/skills-2' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('repository remote state', () => {
  it('stores listings under the repository prefix Go expects', () => {
    expect(getRemoteStateKeyPrefix({ id: 'repo_1' })).toBe('remote-state/repo_1/');
  });

  it('prefers the state of the exact branch', async () => {
    h.remoteState.findUnique.mockResolvedValue({
      commitSha: 'c1',
      treeSha: 't1',
      listingKey: 'remote-state/repo_1/t1.bin',
      entryCount: 5
    });

    await expect(
      repositoryRemoteStateService.getRemoteStateForSync({ sync })
    ).resolves.toEqual({
      commitSha: 'c1',
      treeSha: 't1',
      listingBucket: 'code-bucket',
      listingKey: 'remote-state/repo_1/t1.bin',
      entryCount: 5
    });
    expect(h.remoteState.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to the latest state of the source on a fresh branch', async () => {
    h.remoteState.findUnique.mockResolvedValue(null);
    h.remoteState.findFirst.mockResolvedValue({
      commitSha: 'c0',
      treeSha: 't0',
      listingKey: 'remote-state/repo_1/t0.bin',
      entryCount: 3
    });

    await expect(
      repositoryRemoteStateService.getRemoteStateForSync({ sync })
    ).resolves.toMatchObject({ commitSha: 'c0' });
    expect(h.remoteState.findFirst).toHaveBeenCalledWith({
      where: { repoOid: 10n, sourceKey: 'marketplace:1' },
      orderBy: { updatedAt: 'desc' }
    });
  });

  it('has no cached state for syncs without a source key', async () => {
    await expect(
      repositoryRemoteStateService.getRemoteStateForSync({
        sync: { ...sync, sourceKey: null }
      })
    ).resolves.toBeUndefined();
    expect(h.remoteState.findUnique).not.toHaveBeenCalled();
  });

  it('upserts one row per repository, source and branch', async () => {
    await repositoryRemoteStateService.upsertRemoteState({
      sync,
      state: {
        commitSha: 'c2',
        treeSha: 't2',
        listingBucket: 'code-bucket',
        listingKey: 'remote-state/repo_1/t2.bin',
        entryCount: 7
      }
    });

    expect(h.remoteState.upsert).toHaveBeenCalledWith({
      where: {
        repoOid_sourceKey_branch: {
          repoOid: 10n,
          sourceKey: 'marketplace:1',
          branch: 'metorial/skills-2'
        }
      },
      create: expect.objectContaining({
        repoOid: 10n,
        branch: 'metorial/skills-2',
        commitSha: 'c2'
      }),
      update: {
        commitSha: 'c2',
        treeSha: 't2',
        listingKey: 'remote-state/repo_1/t2.bin',
        entryCount: 7
      }
    });
  });
});

describe('remote state listing GC', () => {
  it('drops state rows older than 30 days and starts a listing sweep', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-08T03:30:00Z'));

    await gcCron();

    expect(h.remoteState.deleteMany).toHaveBeenCalledWith({
      where: { updatedAt: { lt: subDays(new Date('2026-11-08T03:30:00Z'), 30) } }
    });
    expect(h.queues['ori/rem-state/gc-many']!.add).toHaveBeenCalledWith(
      {},
      { id: 'gc:2026-11-08' }
    );
    vi.useRealTimers();
  });

  it('pages through the listing prefix and hands each page to a single job', async () => {
    h.storage.listObjectsPage.mockResolvedValue({
      objects: [{ key: 'remote-state/repo_1/a.bin', last_modified: '2026-11-01T00:00:00Z' }],
      nextContinuationToken: 'next'
    });

    await gcMany({ continuationToken: 'current' });

    expect(h.storage.listObjectsPage).toHaveBeenCalledWith(
      'code-bucket',
      'remote-state/',
      1000,
      'current'
    );
    expect(h.queues['ori/rem-state/gc-single']!.add).toHaveBeenCalledWith({
      objects: [{ key: 'remote-state/repo_1/a.bin', lastModified: '2026-11-01T00:00:00Z' }]
    });
    expect(h.queues['ori/rem-state/gc-many']!.add).toHaveBeenCalledWith({
      continuationToken: 'next'
    });
  });

  it('stops after the last page', async () => {
    h.storage.listObjectsPage.mockResolvedValue({
      objects: [],
      nextContinuationToken: undefined
    });

    await gcMany({});

    expect(h.queues['ori/rem-state/gc-single']!.add).not.toHaveBeenCalled();
    expect(h.queues['ori/rem-state/gc-many']!.add).not.toHaveBeenCalled();
  });

  it('deletes replaced listings but keeps referenced and freshly written ones', async () => {
    let old = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
    let fresh = new Date(Date.now() - 5 * 60_000).toISOString();
    h.remoteState.findMany.mockResolvedValue([
      { listingKey: 'remote-state/repo_1/current.bin' }
    ]);

    await gcSingle({
      objects: [
        { key: 'remote-state/repo_1/current.bin', lastModified: old },
        { key: 'remote-state/repo_1/replaced.bin', lastModified: old },
        { key: 'remote-state/repo_1/in-flight.bin', lastModified: fresh }
      ]
    });

    expect(h.storage.deleteObjects).toHaveBeenCalledWith('code-bucket', [
      'remote-state/repo_1/replaced.bin'
    ]);
  });

  it('skips the delete call when every listing is still in use', async () => {
    h.remoteState.findMany.mockResolvedValue([{ listingKey: 'remote-state/repo_1/a.bin' }]);

    await gcSingle({
      objects: [{ key: 'remote-state/repo_1/a.bin', lastModified: '2020-01-01T00:00:00Z' }]
    });

    expect(h.storage.deleteObjects).not.toHaveBeenCalled();
  });
});
