import { internalServerError, badRequestError, ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, perform, getRepositories, getRemote, syncCodeBucket } = vi.hoisted(() => ({
  db: {
    skillDestinationSync: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    skillDestinationSyncRepositoryPropagation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn()
    },
    skillRepository: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() }
  },
  perform: vi.fn(),
  getRepositories: vi.fn(),
  getRemote: vi.fn(),
  syncCodeBucket: vi.fn()
}));

let { performManifestPropagation, reconcileManifestPropagation } = vi.hoisted(() => ({
  performManifestPropagation: vi.fn(),
  reconcileManifestPropagation: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db,
  ID: { generateId: async () => 'propagation' },
  withTransaction: async (run: (tx: typeof db) => unknown) => run(db)
}));
vi.mock('@metorial/queue', () => ({
  createQueue: () => ({ process: (run: unknown) => run, add: perform }),
  QueueRetryError: Error
}));
vi.mock('@metorial/skills-scm-utils', () => ({
  origin: {
    scmRepository: { getMany: getRepositories, syncCodeBucket },
    scmRepositorySync: { getMany: getRemote }
  },
  getOriginTenant: async () => ({ id: 'tenant_1' }),
  getSkillDestinationCodeBucketId: (destination: { codeBucketId: string }) =>
    destination.codeBucketId
}));
vi.mock('./_lib/lock', () => ({ withDestinationSyncLock: (run: unknown) => run }));
vi.mock('./_lib/deletions', () => ({ getPendingDestinationFileDeletions: async () => [] }));
vi.mock('./_lib/logs', () => ({ appendSkillDestinationSyncLog: vi.fn() }));
vi.mock('./manifest/propagate', () => ({
  manifestPropagationPauseMs: 300_000,
  performManifestPropagation,
  reconcileManifestPropagation,
  getManifestErrorCodeForRejection: (error: { data?: { code?: string } }) =>
    error.data?.code ?? 'request_rejected'
}));

import {
  syncPropagateStartQueueProcessor,
  syncPropagatePerformQueueProcessor,
  syncPropagateWaitQueueProcessor
} from './propagate';

let run = syncPropagateStartQueueProcessor as unknown as (data: {
  skillDestinationSyncId: string;
  skillRepositoryId?: string;
}) => Promise<void>;

describe('repository propagation fanout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.skillDestinationSync.findUnique.mockResolvedValue({
      oid: 10n,
      status: 'processing',
      contentVersion: 0,
      destination: {
        skillMarketplace: {
          repositoryAccessMode: 'default_branch',
          forceMergeOrPush: false,
          mergeBeforeChecksPass: false,
          repositories: [
            { skillRepository: { id: 'repo_a', oid: 1n } },
            { skillRepository: { id: 'repo_b', oid: 2n } }
          ]
        }
      }
    });
    db.skillDestinationSyncRepositoryPropagation.findUnique.mockResolvedValue(null);
    db.skillRepository.update.mockResolvedValue({ syncCounter: 1 });
    db.skillDestinationSyncRepositoryPropagation.create.mockResolvedValue({
      id: 'propagation'
    });
  });

  it('initializes every linked repository even when an older job requested only one', async () => {
    await run({ skillDestinationSyncId: 'sync_1', skillRepositoryId: 'repo_b' });

    let inputs = db.skillDestinationSyncRepositoryPropagation.create.mock.calls.map(
      ([input]) => input.data
    );
    expect(inputs.map(input => input.skillRepositoryOid)).toEqual([1n, 2n]);
    expect(inputs.every(input => input.repositoryAccessMode === 'default_branch')).toBe(true);
    expect(inputs.every(input => input.forceMergeOrPush === false)).toBe(true);
  });

  it('recovers the frozen fanout without adding newly linked repositories', async () => {
    let sync = await db.skillDestinationSync.findUnique();
    db.skillDestinationSync.findUnique.mockResolvedValue({ ...sync, isAtRepoSyncStage: true });
    db.skillDestinationSyncRepositoryPropagation.findMany.mockResolvedValue([
      { id: 'original' }
    ]);

    await run({ skillDestinationSyncId: 'sync_1' });

    expect(db.skillDestinationSyncRepositoryPropagation.create).not.toHaveBeenCalled();
    expect(perform).toHaveBeenCalledWith({
      skillDestinationSyncId: 'sync_1',
      processedPropagationIds: [],
      pendingPropagationIds: ['original']
    });
  });

  it('keeps an empty fanout frozen when a repository was linked afterward', async () => {
    let sync = await db.skillDestinationSync.findUnique();
    db.skillDestinationSync.findUnique.mockResolvedValue({ ...sync, isAtRepoSyncStage: true });
    db.skillDestinationSyncRepositoryPropagation.findMany.mockResolvedValue([]);

    await run({ skillDestinationSyncId: 'sync_1' });

    expect(db.skillDestinationSyncRepositoryPropagation.create).not.toHaveBeenCalled();
    expect(perform).toHaveBeenCalledWith({
      skillDestinationSyncId: 'sync_1',
      processedPropagationIds: [],
      pendingPropagationIds: []
    });
  });

  it('reuses existing propagation records when recovery dispatch runs again', async () => {
    db.skillDestinationSyncRepositoryPropagation.findUnique.mockResolvedValue({
      id: 'existing'
    });

    await run({ skillDestinationSyncId: 'sync_1' });

    expect(db.skillRepository.update).not.toHaveBeenCalled();
    expect(db.skillDestinationSyncRepositoryPropagation.create).not.toHaveBeenCalled();
    expect(perform).toHaveBeenCalledWith({
      skillDestinationSyncId: 'sync_1',
      processedPropagationIds: [],
      pendingPropagationIds: ['existing', 'existing']
    });
  });
});

describe('repository dispatch failures', () => {
  let performRun = syncPropagatePerformQueueProcessor as unknown as (data: {
    skillDestinationSyncId: string;
    pendingPropagationIds: string[];
    processedPropagationIds: string[];
  }) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();
    db.skillDestinationSync.findUnique.mockResolvedValue({
      oid: 10n,
      status: 'processing',
      contentVersion: 0,
      destination: { codeBucketId: 'bucket_1' }
    });
    db.skillDestinationSync.findFirst.mockResolvedValue(null);
    db.skillRepository.findFirst.mockResolvedValue({ oid: 1n });
    db.skillDestinationSyncRepositoryPropagation.findFirst.mockResolvedValue({
      id: 'propagation_1',
      status: 'pending',
      repositoryAccessMode: 'default_branch',
      skillRepository: { project: {}, repoId: 'repo_1' }
    });
  });

  it.each([new Error('connection reset'), new ServiceError(internalServerError())])(
    'retries transient errors without permanently failing the sync: %s',
    async error => {
      getRepositories.mockRejectedValueOnce(error);

      await expect(
        performRun({
          skillDestinationSyncId: 'sync_1',
          pendingPropagationIds: ['propagation_1'],
          processedPropagationIds: []
        })
      ).rejects.toBe(error);

      expect(db.skillDestinationSync.updateMany).not.toHaveBeenCalled();
    }
  );

  it('does not recover an unsent update into a repository that was disconnected', async () => {
    db.skillRepository.findFirst.mockResolvedValue(null);

    await performRun({
      skillDestinationSyncId: 'sync_1',
      pendingPropagationIds: ['propagation_1'],
      processedPropagationIds: []
    });

    expect(getRepositories).not.toHaveBeenCalled();
    expect(syncCodeBucket).not.toHaveBeenCalled();
    expect(db.skillDestinationSyncRepositoryPropagation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'canceled', completedAt: expect.any(Date) }
      })
    );
  });

  it('does not contact Origin if persisting the attempt marker fails', async () => {
    getRepositories.mockResolvedValue({ repositories: [] });
    db.skillDestinationSyncRepositoryPropagation.update.mockRejectedValueOnce(
      new Error('attempt write failed')
    );

    await expect(
      performRun({
        skillDestinationSyncId: 'sync_1',
        pendingPropagationIds: ['propagation_1'],
        processedPropagationIds: []
      })
    ).rejects.toThrow('attempt write failed');

    expect(syncCodeBucket).not.toHaveBeenCalled();
    expect(db.skillDestinationSyncRepositoryPropagation.updateMany).not.toHaveBeenCalled();
  });

  it('reuses the remote request identity if acknowledgement persistence fails', async () => {
    getRepositories.mockResolvedValue({ repositories: [] });
    syncCodeBucket.mockResolvedValue({ id: 'accepted-origin-sync' });
    db.skillDestinationSyncRepositoryPropagation.update
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('DB disconnected'));
    let payload = {
      skillDestinationSyncId: 'sync_1',
      pendingPropagationIds: ['propagation_1'],
      processedPropagationIds: []
    };

    await expect(performRun(payload)).rejects.toThrow('DB disconnected');

    let propagation = await db.skillDestinationSyncRepositoryPropagation.findFirst();
    db.skillDestinationSyncRepositoryPropagation.findFirst.mockResolvedValue({
      ...propagation,
      startedAt: new Date()
    });
    db.skillRepository.findFirst.mockResolvedValue(null);

    await performRun(payload);

    expect(syncCodeBucket).toHaveBeenCalledTimes(2);
    expect(syncCodeBucket.mock.calls[0][0].requestKey).toBe('propagation_1');
    expect(syncCodeBucket.mock.calls[1][0]).toEqual(syncCodeBucket.mock.calls[0][0]);
    expect(db.skillDestinationSyncRepositoryPropagation.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ originSyncId: 'accepted-origin-sync' })
      })
    );
  });

  it('records an actionable permanent rejection as failed', async () => {
    getRepositories.mockRejectedValueOnce(
      new ServiceError(badRequestError({ message: 'Invalid repository' }))
    );

    await performRun({
      skillDestinationSyncId: 'sync_1',
      pendingPropagationIds: ['propagation_1'],
      processedPropagationIds: []
    });

    expect(db.skillDestinationSyncRepositoryPropagation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: 'failed',
          errorMessage: 'Invalid repository',
          completedAt: expect.any(Date)
        }
      })
    );
    expect(db.skillDestinationSync.updateMany).not.toHaveBeenCalled();
  });
});

describe('repository recovery reconciliation', () => {
  let wait = syncPropagateWaitQueueProcessor as unknown as (data: {
    skillDestinationSyncId: string;
    pendingPropagationIds: string[];
  }) => Promise<void>;

  beforeEach(() => {
    vi.resetAllMocks();
    db.skillDestinationSync.findUnique.mockResolvedValue({
      oid: 10n,
      status: 'processing',
      isAtRepoSyncStage: true
    });
    getRepositories.mockResolvedValue({ repositories: [] });
  });

  it('does not complete an unsent repository just because an old payload omitted it', async () => {
    db.skillDestinationSyncRepositoryPropagation.findMany.mockResolvedValue([
      { id: 'new', status: 'pending', originSyncId: null }
    ]);

    await wait({ skillDestinationSyncId: 'sync_1', pendingPropagationIds: [] });

    expect(perform).not.toHaveBeenCalled();
    expect(db.skillDestinationSync.updateMany).not.toHaveBeenCalled();
    expect(db.skillDestinationSyncRepositoryPropagation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { skillDestinationSyncOid: 10n }
      })
    );
  });

  it('never regresses a completed propagation when Origin returns an older status', async () => {
    db.skillDestinationSyncRepositoryPropagation.findMany
      .mockResolvedValueOnce([
        {
          id: 'finished',
          status: 'completed',
          originSyncId: 'origin_1',
          skillRepository: { project: {}, repoId: 'repo_1' }
        }
      ])
      .mockResolvedValueOnce([{ status: 'completed' }]);
    getRemote.mockResolvedValue({ syncs: [{ id: 'origin_1', status: 'syncing_contents' }] });

    await wait({ skillDestinationSyncId: 'sync_1', pendingPropagationIds: ['finished'] });

    expect(db.skillDestinationSyncRepositoryPropagation.updateMany).not.toHaveBeenCalled();
    expect(perform).toHaveBeenCalledWith({ skillDestinationSyncId: 'sync_1' });
  });

  it('records an all-failed fanout even when no remote request was accepted', async () => {
    db.skillDestinationSyncRepositoryPropagation.findMany.mockResolvedValue([
      { status: 'failed', originSyncId: null }
    ]);

    await wait({ skillDestinationSyncId: 'sync_1', pendingPropagationIds: [] });

    expect(db.skillDestinationSync.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'failed', completedAt: expect.any(Date) }
      })
    );
  });
});

describe('manifest propagation wiring', () => {
  let performRun = syncPropagatePerformQueueProcessor as unknown as (data: {
    skillDestinationSyncId: string;
    pendingPropagationIds: string[];
    processedPropagationIds: string[];
  }) => Promise<void>;
  let wait = syncPropagateWaitQueueProcessor as unknown as (data: {
    skillDestinationSyncId: string;
    pendingPropagationIds: string[];
  }) => Promise<void>;

  let manifestSync = {
    oid: 10n,
    destinationOid: 5n,
    status: 'processing',
    contentVersion: 0,
    storageMode: 'manifest',
    manifestOid: 70n,
    isAtRepoSyncStage: true,
    destination: { codeBucketId: null }
  };

  beforeEach(() => {
    vi.resetAllMocks();
    db.skillDestinationSync.findUnique.mockResolvedValue(manifestSync);
    db.skillDestinationSync.findFirst.mockResolvedValue(null);
    db.skillRepository.findFirst.mockResolvedValue({ oid: 1n });
    db.skillDestinationSyncRepositoryPropagation.findFirst.mockResolvedValue({
      id: 'propagation_1',
      oid: 3n,
      status: 'pending',
      originSyncId: 'origin_1',
      repositoryAccessMode: 'pull_request',
      skillRepository: { project: {}, repoId: 'repo_1' }
    });
  });

  it('starts manifest propagations with the manifest and the last manifest sent to that repository', async () => {
    db.skillDestinationSync.findUnique.mockResolvedValue({
      ...manifestSync,
      isAtRepoSyncStage: false,
      destination: {
        skillMarketplace: {
          repositoryAccessMode: 'pull_request',
          forceMergeOrPush: false,
          mergeBeforeChecksPass: false,
          repositories: [
            {
              skillRepository: {
                id: 'repo_a',
                oid: 1n,
                lastPropagatedManifest: { destinationOid: 5n, sha256: 'sha_previous' }
              }
            },
            {
              skillRepository: {
                id: 'repo_b',
                oid: 2n,
                lastPropagatedManifest: { destinationOid: 99n, sha256: 'sha_elsewhere' }
              }
            }
          ]
        }
      }
    });
    db.skillDestinationSyncRepositoryPropagation.findUnique.mockResolvedValue(null);
    db.skillRepository.update.mockResolvedValue({ syncCounter: 1 });
    db.skillDestinationSyncRepositoryPropagation.create.mockResolvedValue({
      id: 'propagation'
    });

    await (syncPropagateStartQueueProcessor as unknown as (d: object) => Promise<void>)({
      skillDestinationSyncId: 'sync_1'
    });

    let inputs = db.skillDestinationSyncRepositoryPropagation.create.mock.calls.map(
      ([input]) => input.data
    );
    expect(inputs.map(input => [input.manifestOid, input.previousManifestSha256])).toEqual([
      [70n, 'sha_previous'],
      [70n, null]
    ]);
    expect(inputs.every(input => input.deletionsUpTo === undefined)).toBe(true);
  });

  it('finishes without propagations when a manifest sync produced no manifest', async () => {
    db.skillDestinationSync.findUnique.mockResolvedValue({
      ...manifestSync,
      manifestOid: null,
      isAtRepoSyncStage: false,
      destination: {
        skillMarketplace: { repositories: [{ skillRepository: { id: 'repo_a', oid: 1n } }] }
      }
    });

    await (syncPropagateStartQueueProcessor as unknown as (d: object) => Promise<void>)({
      skillDestinationSyncId: 'sync_1'
    });

    expect(db.skillDestinationSyncRepositoryPropagation.create).not.toHaveBeenCalled();
    expect(perform).toHaveBeenCalledWith({ skillDestinationSyncId: 'sync_1' });
  });

  it('re-queues the same repository later while propagation is paused', async () => {
    performManifestPropagation.mockResolvedValue('paused');

    await performRun({
      skillDestinationSyncId: 'sync_1',
      pendingPropagationIds: ['propagation_1', 'propagation_2'],
      processedPropagationIds: []
    });

    expect(perform).toHaveBeenCalledTimes(1);
    expect(perform).toHaveBeenCalledWith(
      {
        skillDestinationSyncId: 'sync_1',
        pendingPropagationIds: ['propagation_1', 'propagation_2'],
        processedPropagationIds: []
      },
      expect.objectContaining({ delay: 300_000 })
    );
    expect(syncCodeBucket).not.toHaveBeenCalled();
  });

  it('moves to the next repository once the manifest was sent', async () => {
    performManifestPropagation.mockResolvedValue('sent');

    await performRun({
      skillDestinationSyncId: 'sync_1',
      pendingPropagationIds: ['propagation_1', 'propagation_2'],
      processedPropagationIds: []
    });

    expect(syncCodeBucket).not.toHaveBeenCalled();
    expect(perform).toHaveBeenCalledWith({
      skillDestinationSyncId: 'sync_1',
      processedPropagationIds: ['propagation_1'],
      pendingPropagationIds: ['propagation_2']
    });
  });

  it('records the Origin error code when Origin rejects a manifest sync outright', async () => {
    performManifestPropagation.mockRejectedValue(
      new ServiceError(
        badRequestError({ message: 'Manifest is invalid.', code: 'manifest_invalid' })
      )
    );

    await performRun({
      skillDestinationSyncId: 'sync_1',
      pendingPropagationIds: ['propagation_1'],
      processedPropagationIds: []
    });

    expect(db.skillDestinationSyncRepositoryPropagation.updateMany).toHaveBeenCalledWith({
      where: { id: 'propagation_1' },
      data: expect.objectContaining({ status: 'failed', errorCode: 'manifest_invalid' })
    });
  });

  it('polls again when Origin says a waiting repository can be retried', async () => {
    let waitingUntil = new Date(Date.now() + 60_000);
    db.skillDestinationSyncRepositoryPropagation.findMany
      .mockResolvedValueOnce([
        {
          id: 'propagation_1',
          status: 'processing',
          originSyncId: 'origin_1',
          skillRepository: { project: {}, repoId: 'repo_1' }
        }
      ])
      .mockResolvedValueOnce([{ status: 'processing' }]);
    getRemote.mockResolvedValue({ syncs: [{ id: 'origin_1', status: 'syncing_contents' }] });
    getRepositories.mockResolvedValue({ repositories: [] });
    reconcileManifestPropagation.mockResolvedValue({ waitingUntil });

    await wait({ skillDestinationSyncId: 'sync_1', pendingPropagationIds: ['propagation_1'] });

    expect(reconcileManifestPropagation).toHaveBeenCalledWith(
      expect.objectContaining({ originSync: { id: 'origin_1', status: 'syncing_contents' } })
    );
    expect(perform).toHaveBeenCalledWith(
      { skillDestinationSyncId: 'sync_1', pendingPropagationIds: ['propagation_1'] },
      expect.objectContaining({
        id: `waiting:sync_1:${waitingUntil.getTime()}`,
        delay: expect.any(Number)
      })
    );
  });
});
