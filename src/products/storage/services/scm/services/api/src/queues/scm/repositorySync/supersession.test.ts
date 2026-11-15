import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, transition, snapshot, exportFiles, lock, merge } = vi.hoisted(() => ({
  db: { scmRepositorySync: { findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() } },
  transition: vi.fn(),
  snapshot: vi.fn(),
  exportFiles: vi.fn(),
  lock: vi.fn(),
  merge: vi.fn()
}));

vi.mock('../../../db', () => ({ db }));
vi.mock('../../../env', () => ({ env: { service: { REDIS_URL: 'unused' } } }));
vi.mock('@lowerdeck/queue', () => ({
  createQueue: () => ({ process: (run: unknown) => run })
}));
vi.mock('../../../lib/repositorySyncWriteLock', () => ({
  withRepositorySyncWriteLock: (run: (data: unknown) => unknown) => async (data: unknown) => {
    lock();
    return run(data);
  }
}));
vi.mock('../../../services', () => ({
  codeBucketService: { exportCodeBucketToRepoNow: exportFiles }
}));
vi.mock('../../../services/repositorySyncState', () => ({
  transitionRepositorySyncState: transition
}));
vi.mock('../../../lib/scmRepositorySyncProvider', () => ({
  getRepositorySyncStatusSnapshot: snapshot,
  mergeRepositorySyncPullRequest: merge
}));
vi.mock('../../../lib/exportLimiter', () => ({
  exportLimiter: {},
  getExportLimiterAccount: vi.fn()
}));
vi.mock('../../../services/manifestExport', () => ({ manifestExportService: {} }));
vi.mock('../../../services/repositoryRemoteState', () => ({
  repositoryRemoteStateService: {}
}));
vi.mock('./createPr', () => ({ createPrRepositorySyncQueue: {} }));
vi.mock('./_lib', () => ({
  logRepositorySyncQueueEvent: vi.fn(),
  logRepositorySyncQueueError: vi.fn(),
  appendRepositorySyncLog: vi.fn(),
  markRepositorySyncFailed: vi.fn()
}));

import {
  cancelSupersededRepositorySync,
  getSyncSourceScope
} from '../../../services/repositorySyncSupersession';
import { mergeRepositorySyncQueueProcessor } from './merge';
import { syncContentsRepositorySyncQueueProcessor } from './syncContents';

let row = { id: 'old', oid: 1n, repoOid: 10n, codeBucketOid: 20n, status: 'merging' };

describe('superseded repository side effects', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    snapshot.mockResolvedValue({ pullRequest: { state: 'open' } });
    db.scmRepositorySync.updateMany.mockResolvedValue({ count: 1 });
    db.scmRepositorySync.findFirst.mockImplementation(async input => {
      if (input.where.oid?.gt) return { id: 'newer' };
      if (input.where.repositoryAccessMode === 'default_branch') return null;
      return row;
    });
  });

  it.each([
    ['merge', mergeRepositorySyncQueueProcessor],
    ['file export', syncContentsRepositorySyncQueueProcessor]
  ])('cancels stale %s work before reaching the provider', async (_label, processor) => {
    let run = processor as unknown as (data: { syncId: string }) => Promise<void>;

    await run({ syncId: 'old' });

    expect(lock).toHaveBeenCalledOnce();
    expect(transition).toHaveBeenCalledWith(
      'old',
      'merging',
      expect.objectContaining({
        status: 'cancelled',
        completedAt: expect.any(Date)
      })
    );
    expect(merge).not.toHaveBeenCalled();
    expect(exportFiles).not.toHaveBeenCalled();
  });
});

describe('repository sync source scope', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    transition.mockResolvedValue({});
  });

  it.each([
    [
      {
        repoOid: 10n,
        sourceType: 'code_bucket',
        codeBucketOid: 20n,
        sourceKey: null,
        baseBranch: 'main',
        repositoryAccessMode: 'pull_request'
      },
      { repoOid: 10n, sourceType: 'code_bucket', codeBucketOid: 20n }
    ],
    [
      {
        repoOid: 10n,
        sourceType: 'manifest',
        codeBucketOid: null,
        sourceKey: 'marketplace:1',
        baseBranch: 'release/x',
        repositoryAccessMode: 'pull_request'
      },
      {
        repoOid: 10n,
        sourceType: 'manifest',
        sourceKey: 'marketplace:1',
        baseBranch: 'release/x',
        repositoryAccessMode: 'pull_request'
      }
    ]
  ])('scopes %o to %o', (sync, scope) => {
    expect(getSyncSourceScope(sync as any)).toEqual(scope);
  });

  describe('against stored syncs', () => {
    let manifestSync = (oid: bigint, overrides: Record<string, unknown> = {}) => ({
      id: `sync_${oid}`,
      oid,
      repoOid: 10n,
      status: 'syncing_contents',
      sourceType: 'manifest',
      sourceKey: 'marketplace:1',
      codeBucketOid: null,
      baseBranch: 'main',
      repositoryAccessMode: 'pull_request',
      ...overrides
    });

    let useRows = (rows: Record<string, any>[]) =>
      db.scmRepositorySync.findFirst.mockImplementation(async ({ where }) => {
        let found = rows
          .filter(row =>
            Object.entries(where).every(([key, expected]: [string, any]) =>
              key === 'oid' ? row.oid > expected.gt : row[key] === expected
            )
          )
          .sort((a, b) => Number(b.oid - a.oid));
        return found[0] ?? null;
      });

    it.each([
      ['another base branch', { baseBranch: 'release/x' }],
      ['direct pushes', { repositoryAccessMode: 'default_branch' }],
      ['another source', { sourceKey: 'marketplace:2' }]
    ])('is not superseded by a newer manifest sync for %s', async (_label, overrides) => {
      let older = manifestSync(1n);
      useRows([older, manifestSync(2n, overrides)]);

      await expect(cancelSupersededRepositorySync(older as any)).resolves.toBe(false);
      expect(transition).not.toHaveBeenCalled();
    });

    it('is superseded by a newer manifest sync for the same branch and mode', async () => {
      let older = manifestSync(1n, { baseBranch: 'release/x' });
      useRows([older, manifestSync(2n), manifestSync(3n, { baseBranch: 'release/x' })]);

      await expect(cancelSupersededRepositorySync(older as any)).resolves.toBe(true);
      expect(transition).toHaveBeenCalledWith(
        older.id,
        'syncing_contents',
        expect.objectContaining({ supersededBySyncOid: 3n })
      );
    });

    it('keeps superseding code-bucket syncs across base branches and modes', async () => {
      let codeBucket = {
        sourceType: 'code_bucket',
        sourceKey: null,
        codeBucketOid: 20n
      };
      let older = manifestSync(1n, codeBucket);
      useRows([
        older,
        manifestSync(2n, {
          ...codeBucket,
          baseBranch: 'release/x',
          repositoryAccessMode: 'default_branch'
        })
      ]);

      await expect(cancelSupersededRepositorySync(older as any)).resolves.toBe(true);
    });
  });

  it.each([
    ['manifest', { sourceKey: 'marketplace:1', codeBucketOid: null }],
    ['code_bucket', { sourceKey: null, codeBucketOid: 20n }]
  ])('only looks for newer %s syncs in the same scope', async (sourceType, source) => {
    db.scmRepositorySync.findFirst.mockResolvedValue(null);

    await expect(
      cancelSupersededRepositorySync({
        id: 'old',
        oid: 1n,
        repoOid: 10n,
        status: 'syncing_contents',
        sourceType,
        baseBranch: 'main',
        repositoryAccessMode: 'pull_request',
        ...source
      } as any)
    ).resolves.toBe(false);

    let where = db.scmRepositorySync.findFirst.mock.calls[0]![0].where;
    expect(where).toMatchObject({ repoOid: 10n, sourceType, oid: { gt: 1n } });
    if (sourceType === 'manifest') {
      expect(where).toMatchObject({
        sourceKey: 'marketplace:1',
        baseBranch: 'main',
        repositoryAccessMode: 'pull_request'
      });
      expect(where).not.toHaveProperty('codeBucketOid');
    } else {
      expect(where).toMatchObject({ codeBucketOid: 20n });
      expect(where).not.toHaveProperty('sourceKey');
      expect(where).not.toHaveProperty('baseBranch');
    }
  });

  it('links a superseded manifest sync to the newer one', async () => {
    db.scmRepositorySync.findFirst.mockResolvedValue({ oid: 5n });

    await cancelSupersededRepositorySync({
      id: 'old',
      oid: 1n,
      repoOid: 10n,
      status: 'waiting_for_review',
      sourceType: 'manifest',
      sourceKey: 'marketplace:1',
      codeBucketOid: null
    } as any);

    expect(transition).toHaveBeenCalledWith(
      'old',
      'waiting_for_review',
      expect.objectContaining({
        status: 'cancelled',
        endReason: 'superseded',
        supersededBySyncOid: 5n
      })
    );
  });

  it('keeps code-bucket supersession free of manifest fields', async () => {
    db.scmRepositorySync.findFirst.mockResolvedValue({ oid: 5n });

    await cancelSupersededRepositorySync({
      id: 'old',
      oid: 1n,
      repoOid: 10n,
      status: 'merging',
      sourceType: 'code_bucket',
      sourceKey: null,
      codeBucketOid: 20n
    } as any);

    let data = transition.mock.calls[0]![2];
    expect(data).not.toHaveProperty('endReason');
    expect(data).not.toHaveProperty('supersededBySyncOid');
  });
});
