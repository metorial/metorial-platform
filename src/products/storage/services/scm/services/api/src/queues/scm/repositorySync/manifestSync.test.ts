import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let h = vi.hoisted(() => {
  let rows = new Map<string, any>();
  let queues: Record<string, { add: ReturnType<typeof vi.fn> }> = {};

  let matches = (row: any, where: any): boolean =>
    Object.entries(where ?? {}).every(([key, expected]: [string, any]) => {
      if (key === 'NOT') return !matches(row, expected);
      if (key === 'OR') return expected.some((clause: any) => matches(row, clause));
      let value = row[key];
      if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
        if ('gt' in expected && !(value > expected.gt)) return false;
        if ('lt' in expected && !(value < expected.lt)) return false;
        if ('in' in expected && !expected.in.includes(value)) return false;
        if ('notIn' in expected && expected.notIn.includes(value)) return false;
        if ('not' in expected && value === expected.not) return false;
        if ('not' in expected && expected.not === null && value == null) return false;
        return true;
      }
      return value === expected;
    });

  let apply = (row: any, data: any) => {
    for (let [key, value] of Object.entries(data) as [string, any][]) {
      if (value && typeof value === 'object' && 'increment' in value) {
        row[key] = (row[key] ?? 0) + value.increment;
      } else if (value && typeof value === 'object' && 'push' in value) {
        row[key] = [...(row[key] ?? []), value.push];
      } else if (value !== undefined) {
        row[key] = value;
      }
    }
    row.updatedAt = new Date();
    return row;
  };

  let find = (where: any, orderBy?: any) => {
    let found = [...rows.values()].filter(row => matches(row, where));
    if (orderBy?.oid === 'desc') found.sort((a, b) => Number(b.oid - a.oid));
    if (orderBy?.oid === 'asc') found.sort((a, b) => Number(a.oid - b.oid));
    return found;
  };

  let project = (row: any, select?: any) => {
    if (!row) return null;
    if (!select) return { ...row };
    return Object.fromEntries(Object.keys(select).map(key => [key, row[key]]));
  };

  let db = {
    scmRepositorySync: {
      findFirst: vi.fn(async (args: any) =>
        project(find(args.where, args.orderBy)[0], args.select)
      ),
      findUnique: vi.fn(async (args: any) => project(rows.get(args.where.id), args.select)),
      findMany: vi.fn(async (args: any) =>
        find(args.where, args.orderBy).map(row => project(row, args.select))
      ),
      updateMany: vi.fn(async (args: any) => {
        let found = find(args.where);
        for (let row of found) apply(row, args.data);
        return { count: found.length };
      })
    },
    scmRepository: { update: vi.fn() }
  };

  let transition = vi.fn(async (id: string, expected: string, data: any) => {
    let row = rows.get(id);
    if (!row || row.status !== expected) return null;
    return apply(row, data);
  });

  return {
    rows,
    queues,
    db,
    transition,
    provider: {
      cleanupRepositorySyncBranchIfNoChanges: vi.fn(),
      closeRepositorySyncPullRequest: vi.fn(),
      compareRepositorySyncBranchContents: vi.fn(),
      createRepositorySyncBranch: vi.fn(),
      deleteRepositorySyncBranch: vi.fn(),
      createRepositorySyncPullRequest: vi.fn(),
      getRepositorySyncBranchSha: vi.fn(),
      getRepositorySyncBranchShaOrNull: vi.fn(),
      getRepositorySyncDismissal: vi.fn(),
      getRepositorySyncPullRequestState: vi.fn(),
      getRepositorySyncStatusSnapshot: vi.fn(),
      mergeRepositorySyncPullRequest: vi.fn(),
      prepareRepositorySyncDefaultBranch: vi.fn(),
      resetRepositorySyncBranch: vi.fn(),
      updateRepositorySyncPullRequest: vi.fn()
    },
    limiter: { acquire: vi.fn(), release: vi.fn() },
    exportManifest: vi.fn(),
    exportCodeBucket: vi.fn(),
    remoteState: { getRemoteStateForSync: vi.fn(), upsertRemoteState: vi.fn() },
    classify: vi.fn()
  };
});

vi.mock('@lowerdeck/sentry', () => ({ getSentry: () => ({ captureException: vi.fn() }) }));
vi.mock('../../../db', () => ({ db: h.db }));
vi.mock('../../../env', () => ({
  env: {
    service: { REDIS_URL: 'redis://unused' },
    manifestSync: {
      ORIGIN_EXPORT_WRITE_BUDGET: 30,
      ORIGIN_EXPORT_SLICE_SECONDS: 600,
      ORIGIN_EXPORT_MAX_NO_PROGRESS_SLICES: 10
    }
  }
}));
vi.mock('@lowerdeck/queue', () => ({
  createQueue: ({ name }: { name: string }) => {
    let queue = { add: vi.fn(), process: (run: unknown) => run };
    h.queues[name] = queue;
    return queue;
  }
}));
vi.mock('../../../lib/repositorySyncWriteLock', () => ({
  withRepositorySyncWriteLock: (run: (data: unknown) => unknown) => run
}));
vi.mock('../../../services/repositorySyncState', () => ({
  transitionRepositorySyncState: h.transition,
  isTerminalRepositorySyncStatus: (status: string) =>
    [
      'merged',
      'cancelled',
      'failed',
      'complete_unmerged',
      'complete_direct_push',
      'complete_no_changes'
    ].includes(status),
  classifyRepositorySyncSnapshot: h.classify,
  claimRepositorySyncMergeAttempt: vi.fn()
}));
vi.mock('../../../lib/scmRepositorySyncProvider', () => h.provider);
vi.mock('../../../lib/exportLimiter', () => ({
  exportLimiter: h.limiter,
  getExportLimiterAccount: () => ({
    key: 'github:api:1',
    writesPerMinute: 60,
    writesPerHour: 450
  })
}));
vi.mock('../../../services/manifestExport', () => {
  let emptyManifestExportStats = () => ({
    filesTotal: 0,
    filesUploaded: 0,
    filesSkipped: 0,
    blobsCreated: 0,
    blobsReused: 0,
    lfsUploaded: 0,
    bytesUploaded: 0,
    deleted: 0,
    unexpectedDeletes: 0,
    githubRequests: 0,
    rateLimitWaitMs: 0,
    commitsCreated: 0,
    batchSizeReductions: 0
  });
  return {
    manifestExportService: { exportManifestToRepoNow: h.exportManifest },
    emptyManifestExportStats,
    toManifestExportStats: (stats: Record<string, number>) => ({
      ...emptyManifestExportStats(),
      ...stats
    })
  };
});
vi.mock('../../../services/repositoryRemoteState', () => ({
  repositoryRemoteStateService: h.remoteState
}));
vi.mock('../../../services', () => ({
  codeBucketService: { exportCodeBucketToRepoNow: h.exportCodeBucket }
}));

import { EXPORT_ERROR_PREFIX } from '../../../lib/exportError';
import { MANIFEST_SYNC_LIFETIME_MS } from './_lib';
import { createBranchRepositorySyncQueueProcessor } from './createBranch';
import { createPrRepositorySyncQueueProcessor } from './createPr';
import { mergeRepositorySyncQueueProcessor } from './merge';
import { syncContentsRepositorySyncQueueProcessor } from './syncContents';
import { waitForCiRepositorySyncQueueProcessor } from './waitForCi';

type Run = (data: { syncId: string }) => Promise<void>;
let syncContents = syncContentsRepositorySyncQueueProcessor as unknown as Run;
let createBranch = createBranchRepositorySyncQueueProcessor as unknown as Run;
let createPr = createPrRepositorySyncQueueProcessor as unknown as Run;
let waitForCi = waitForCiRepositorySyncQueueProcessor as unknown as Run;
let merge = mergeRepositorySyncQueueProcessor as unknown as Run;

let queue = (name: string) => h.queues[name]!.add;
let contentsQueue = () => queue('ori/rep-sync/contents');
let branchQueue = () => queue('ori/rep-sync/branch');
let prQueue = () => queue('ori/rep-sync/pr');
let ciQueue = () => queue('ori/rep-sync/wait-ci');

let repo = (provider = 'github', backendType = provider) => ({
  oid: 10n,
  id: 'repo_1',
  provider,
  externalOwner: 'acme',
  externalName: 'skills',
  installation: { backend: { type: backendType } }
});

let addSync = (overrides: Record<string, any> = {}) => {
  let oid = overrides.oid ?? BigInt(h.rows.size + 1);
  let row: Record<string, any> = {
    id: `sync_${oid}`,
    oid,
    repoOid: 10n,
    status: 'syncing_contents',
    sourceType: 'manifest',
    sourceKey: 'marketplace:1',
    codeBucketOid: null,
    repositoryAccessMode: 'pull_request',
    branchName: `metorial/skills-${oid}`,
    requestedBranchName: `metorial/skills-${oid}`,
    baseBranch: 'main',
    baseCommitSha: 'base_sha',
    lastPushedCommitSha: null,
    foreignCommitsOnBranch: false,
    providerPrId: null,
    providerPrUrl: null,
    continuedFromSyncOid: null,
    supersededBySyncOid: null,
    endReason: null,
    enableAutoMerge: true,
    attemptCount: 0,
    noProgressSliceCount: 0,
    resultStats: null,
    waitingReason: null,
    nextPollAt: null,
    createdAt: new Date(),
    completedAt: null,
    errorMessage: null,
    logs: [],
    title: 'Update skills',
    ...overrides,
    repo: repo(overrides.provider, overrides.backendType)
  };
  h.rows.set(row.id, row);
  return row;
};

let stats = (overrides: Record<string, number> = {}) => ({
  filesTotal: 10,
  filesUploaded: 0,
  filesSkipped: 0,
  blobsCreated: 0,
  blobsReused: 0,
  lfsUploaded: 0,
  bytesUploaded: 0,
  deleted: 0,
  unexpectedDeletes: 0,
  githubRequests: 0,
  rateLimitWaitMs: 0,
  commitsCreated: 0,
  batchSizeReductions: 0,
  ...overrides
});

let lineage = (startHeadSha: string | null, lastCommitSha: string | null = null) => ({
  startHeadSha,
  lastCommitSha,
  foreignCommits: false
});

let exportResult = (overrides: Record<string, any> = {}) => ({
  stats: stats(),
  commitsCreated: 0,
  writeRequests: 0,
  lineage: lineage(null),
  partial: false,
  newRemoteState: null,
  retryAfter: null,
  ...overrides
});

let exportError = (payload: Record<string, unknown>) => {
  let details = `${EXPORT_ERROR_PREFIX}${JSON.stringify({ message: 'Export failed', ...payload })}`;
  return Object.assign(new Error(`/rpc.CodeBucket/ExportBucketToGithub FAILED: ${details}`), {
    code: 9,
    details
  });
};

let remote = (commitSha: string) => ({
  commitSha,
  treeSha: `${commitSha}_tree`,
  listingBucket: 'code-bucket',
  listingKey: `remote-state/repo_1/${commitSha}_tree.bin`,
  entryCount: 10
});

let advancePastPoll = (sync: Record<string, any>) => {
  if (sync.nextPollAt) vi.setSystemTime(sync.nextPollAt.getTime() + 1);
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-08T12:00:00Z'));
  h.rows.clear();
  vi.clearAllMocks();
  h.limiter.acquire.mockResolvedValue({ granted: true, tokens: 30 });
  h.limiter.release.mockResolvedValue(undefined);
  h.remoteState.getRemoteStateForSync.mockResolvedValue(undefined);
  h.provider.cleanupRepositorySyncBranchIfNoChanges.mockResolvedValue({
    hasChanges: true,
    baseSha: 'base_sha',
    branchSha: 'head_sha'
  });
  h.provider.compareRepositorySyncBranchContents.mockResolvedValue({
    identical: false,
    baseSha: 'base_sha',
    branchSha: 'head_sha'
  });
  h.provider.getRepositorySyncBranchShaOrNull.mockResolvedValue('head_sha');
  h.provider.getRepositorySyncDismissal.mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('manifest syncContents slices', () => {
  it('exports with the granted write budget and the cached remote state', async () => {
    let sync = addSync();
    let cached = remote('cached');
    h.remoteState.getRemoteStateForSync.mockResolvedValue(cached);
    h.exportManifest.mockResolvedValue(exportResult());

    await syncContents({ syncId: sync.id });

    expect(h.limiter.acquire).toHaveBeenCalledWith(
      expect.objectContaining({ holder: sync.id, want: 30, leaseMs: 900_000 })
    );
    expect(h.exportManifest).toHaveBeenCalledWith(
      expect.objectContaining({ writeBudget: 30, remoteState: cached })
    );
    expect(h.exportCodeBucket).not.toHaveBeenCalled();
  });

  it('re-enqueues a partial slice immediately and records progress', async () => {
    let sync = addSync({ attemptCount: 2, lastPushedCommitSha: 'start' });
    h.exportManifest.mockResolvedValue(
      exportResult({
        partial: true,
        commitsCreated: 1,
        writeRequests: 12,
        lineage: lineage('start', 'slice1'),
        stats: stats({ commitsCreated: 1, blobsCreated: 8, githubRequests: 14 }),
        newRemoteState: remote('slice1')
      })
    );

    await syncContents({ syncId: sync.id });

    expect(contentsQueue()).toHaveBeenCalledWith({ syncId: sync.id });
    expect(h.limiter.release).toHaveBeenCalledWith(
      expect.objectContaining({ holder: sync.id, granted: 30, used: 12 })
    );
    expect(h.remoteState.upsertRemoteState).toHaveBeenCalledWith(
      expect.objectContaining({ state: remote('slice1') })
    );
    expect(sync).toMatchObject({
      status: 'syncing_contents',
      attemptCount: 0,
      lastPushedCommitSha: 'slice1',
      foreignCommitsOnBranch: false,
      resultStats: expect.objectContaining({ commitsCreated: 1, blobsCreated: 8 })
    });
  });

  it('accumulates stats across slices and opens the PR on completion', async () => {
    let sync = addSync({
      resultStats: stats({ commitsCreated: 2, filesUploaded: 5 }),
      lastPushedCommitSha: 'slice2'
    });
    h.exportManifest.mockResolvedValue(
      exportResult({
        commitsCreated: 1,
        lineage: lineage('slice2', 'final'),
        stats: stats({ commitsCreated: 1, filesUploaded: 3 }),
        newRemoteState: remote('final')
      })
    );

    await syncContents({ syncId: sync.id });

    expect(sync).toMatchObject({
      status: 'creating_pr',
      lastPushedCommitSha: 'final',
      foreignCommitsOnBranch: false,
      resultStats: expect.objectContaining({ commitsCreated: 3, filesUploaded: 8 })
    });
    expect(prQueue()).toHaveBeenCalledWith({ syncId: sync.id });
  });

  describe('when the branch has no net changes left', () => {
    beforeEach(() => {
      h.exportManifest.mockResolvedValue(exportResult({ newRemoteState: remote('final') }));
      h.provider.compareRepositorySyncBranchContents.mockResolvedValue({
        identical: true,
        baseSha: 'base_sha',
        branchSha: 'head_sha'
      });
      h.provider.closeRepositorySyncPullRequest.mockResolvedValue('closed');
    });

    it('closes an adopted PR with a comment instead of leaving it empty', async () => {
      let sync = addSync({ providerPrId: '41', continuedFromSyncOid: 1n });

      await syncContents({ syncId: sync.id });

      expect(h.provider.closeRepositorySyncPullRequest).toHaveBeenCalledWith(
        expect.objectContaining({ id: sync.id }),
        { comment: 'No remaining changes from Metorial.' }
      );
      expect(h.provider.deleteRepositorySyncBranch).toHaveBeenCalled();
      expect(sync.status).toBe('complete_no_changes');
      expect(prQueue()).not.toHaveBeenCalled();
    });

    it('records a merge if the PR was merged in the meantime', async () => {
      let sync = addSync({ providerPrId: '41', continuedFromSyncOid: 1n });
      h.provider.closeRepositorySyncPullRequest.mockResolvedValue('merged');

      await syncContents({ syncId: sync.id });

      expect(h.provider.deleteRepositorySyncBranch).not.toHaveBeenCalled();
      expect(sync.status).toBe('merged');
    });

    it('drops an adopted branch that never got a PR', async () => {
      let sync = addSync({ continuedFromSyncOid: 1n });

      await syncContents({ syncId: sync.id });

      expect(h.provider.closeRepositorySyncPullRequest).not.toHaveBeenCalled();
      expect(h.provider.deleteRepositorySyncBranch).toHaveBeenCalled();
      expect(sync.status).toBe('complete_no_changes');
    });

    it('drops a fresh branch whose commits net out to the base tree', async () => {
      let sync = addSync();

      await syncContents({ syncId: sync.id });

      expect(h.provider.deleteRepositorySyncBranch).toHaveBeenCalled();
      expect(sync.status).toBe('complete_no_changes');
    });
  });

  it.each([
    [2, 'complete_direct_push'],
    [0, 'complete_no_changes']
  ])('completes a direct push with %i commits as %s', async (commits, status) => {
    let sync = addSync({ repositoryAccessMode: 'default_branch', branchName: 'main' });
    h.exportManifest.mockResolvedValue(
      exportResult({
        commitsCreated: commits,
        stats: stats({ commitsCreated: commits }),
        newRemoteState: commits ? remote('pushed') : null
      })
    );

    await syncContents({ syncId: sync.id });

    expect(sync.status).toBe(status);
    expect(h.provider.compareRepositorySyncBranchContents).not.toHaveBeenCalled();
  });

  it('never fails a 20-slice sync that keeps making progress through rate limits', async () => {
    let sync = addSync();
    h.exportManifest.mockRejectedValue(
      exportError({ code: 'rate_limited', commitsCreated: 1, stats: { commitsCreated: 1 } })
    );

    for (let slice = 0; slice < 20; slice++) {
      advancePastPoll(sync);
      await syncContents({ syncId: sync.id });
    }

    expect(h.exportManifest).toHaveBeenCalledTimes(20);
    expect(sync).toMatchObject({ status: 'syncing_contents', attemptCount: 0 });
    expect(sync.resultStats.commitsCreated).toBe(20);
  });

  it('fails after six rate-limited slices without progress', async () => {
    let sync = addSync();
    h.exportManifest.mockRejectedValue(exportError({ code: 'rate_limited' }));

    for (let slice = 0; slice < 6; slice++) {
      advancePastPoll(sync);
      await syncContents({ syncId: sync.id });
    }

    expect(h.exportManifest).toHaveBeenCalledTimes(6);
    expect(sync).toMatchObject({ status: 'failed', errorCode: 'rate_limited' });
  });

  it('waits until retry_after (with jitter, capped at 1 h) before the next slice', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    let sync = addSync();
    let retryAfterUnix = Math.floor(Date.now() / 1000) + 120;
    h.exportManifest.mockRejectedValue(exportError({ code: 'rate_limited', retryAfterUnix }));

    await syncContents({ syncId: sync.id });

    expect(sync).toMatchObject({ waitingReason: 'rate_limited', attemptCount: 1 });
    expect(sync.nextPollAt.getTime()).toBe(retryAfterUnix * 1000);
    expect(contentsQueue()).toHaveBeenCalledWith(
      { syncId: sync.id },
      expect.objectContaining({ delay: 120_000 })
    );

    h.exportManifest.mockClear();
    await syncContents({ syncId: sync.id });
    expect(h.exportManifest).not.toHaveBeenCalled();
  });

  it('cancels with branch_deleted when Go reports branch_missing', async () => {
    let sync = addSync();
    h.exportManifest.mockRejectedValue(exportError({ code: 'branch_missing' }));

    await syncContents({ syncId: sync.id });

    expect(sync).toMatchObject({ status: 'cancelled', endReason: 'branch_deleted' });
  });

  it.each([
    [{ state: 'closed', conflicting: false }, 'pull_request_closed'],
    [{ state: 'missing', conflicting: false }, 'pull_request_deleted'],
    [{ state: 'open', conflicting: false }, 'branch_deleted']
  ])(
    'stops writing when the PR is dismissed mid-sync (%o)',
    async (pullRequest, endReason) => {
      let sync = addSync({ providerPrId: '42' });
      h.provider.getRepositorySyncPullRequestState.mockResolvedValue(pullRequest);
      h.provider.getRepositorySyncDismissal.mockResolvedValue(endReason);

      await syncContents({ syncId: sync.id });

      expect(sync).toMatchObject({ status: 'cancelled', endReason });
      expect(h.exportManifest).not.toHaveBeenCalled();
      expect(h.provider.createRepositorySyncBranch).not.toHaveBeenCalled();
    }
  );

  it('starts over on a fresh branch when the adopted PR was merged mid-sync', async () => {
    let sync = addSync({
      providerPrId: '42',
      branchName: 'metorial/skills-old',
      continuedFromSyncOid: 1n,
      requestedBranchName: 'metorial/skills-new'
    });
    h.provider.getRepositorySyncPullRequestState.mockResolvedValue({
      state: 'merged',
      conflicting: false
    });

    await syncContents({ syncId: sync.id });

    expect(sync).toMatchObject({
      status: 'creating_branch',
      branchName: 'metorial/skills-new',
      providerPrId: null,
      baseCommitSha: null,
      continuedFromSyncOid: null
    });
    expect(branchQueue()).toHaveBeenCalledWith({ syncId: sync.id });
    expect(h.exportManifest).not.toHaveBeenCalled();
  });

  it('skips Go entirely while the account bucket is empty', async () => {
    let sync = addSync();
    let retryAt = new Date(Date.now() + 40_000);
    h.limiter.acquire.mockResolvedValue({ granted: false, reason: 'tokens', retryAt });

    await syncContents({ syncId: sync.id });

    expect(h.exportManifest).not.toHaveBeenCalled();
    expect(sync).toMatchObject({ waitingReason: 'rate_limited', nextPollAt: retryAt });
    expect(contentsQueue()).toHaveBeenCalledWith(
      { syncId: sync.id },
      expect.objectContaining({ delay: 40_000 })
    );
  });

  it('waits for a concurrency slot without counting an attempt', async () => {
    let sync = addSync();
    h.limiter.acquire.mockResolvedValue({
      granted: false,
      reason: 'concurrency',
      retryAt: new Date(Date.now() + 20_000)
    });

    await syncContents({ syncId: sync.id });

    expect(sync).toMatchObject({ waitingReason: 'rate_limited', attemptCount: 0 });
  });

  it('retries on the existing branch without recreating it', async () => {
    let sync = addSync({ branchName: 'metorial/skills-adopted', baseCommitSha: 'base' });
    h.exportManifest
      .mockRejectedValueOnce(Object.assign(new Error('Bad gateway'), { status: 502 }))
      .mockResolvedValueOnce(
        exportResult({ commitsCreated: 1, stats: stats({ commitsCreated: 1 }) })
      );

    await syncContents({ syncId: sync.id });
    advancePastPoll(sync);
    await syncContents({ syncId: sync.id });

    expect(h.exportManifest).toHaveBeenCalledTimes(2);
    for (let call of h.exportManifest.mock.calls) {
      expect(call[0].sync.branchName).toBe('metorial/skills-adopted');
    }
    expect(h.provider.createRepositorySyncBranch).not.toHaveBeenCalled();
    expect(sync.status).toBe('creating_pr');
  });

  it('fails a sync that outlived the 48 h lifetime without calling Go', async () => {
    let sync = addSync({
      createdAt: new Date(Date.now() - MANIFEST_SYNC_LIFETIME_MS - 1),
      waitingReason: 'rate_limited'
    });

    await syncContents({ syncId: sync.id });

    expect(h.exportManifest).not.toHaveBeenCalled();
    expect(sync).toMatchObject({ status: 'failed', errorCode: 'rate_limited' });
  });

  it('records structured details for a tripped deletion guard', async () => {
    let sync = addSync();
    h.exportManifest.mockRejectedValue(
      exportError({
        code: 'deletion_guard_tripped',
        details: { unexpectedDeletes: 120, maxUnexpectedDeletes: 50 },
        writeRequests: 4,
        stats: { githubRequests: 6 }
      })
    );

    await syncContents({ syncId: sync.id });

    expect(sync).toMatchObject({
      status: 'failed',
      errorCode: 'deletion_guard_tripped',
      errorDetails: { unexpectedDeletes: 120, maxUnexpectedDeletes: 50 }
    });
    expect(h.limiter.release).toHaveBeenCalledWith(
      expect.objectContaining({ granted: 30, used: 4 })
    );
  });

  it('keeps every sampled missing key so Metorial can rebuild just those items', async () => {
    let sync = addSync();
    let keys = ['skill-sync/blobs/sha256/aa', 'skill-sync/blobs/sha256/bb'];
    h.exportManifest.mockRejectedValue(
      exportError({
        code: 'source_not_found',
        details: { key: keys[0], keys, paths: ['plugins/a/SKILL.md', 'plugins/b/SKILL.md'] }
      })
    );

    await syncContents({ syncId: sync.id });

    expect(sync).toMatchObject({
      status: 'failed',
      errorCode: 'source_not_found',
      errorDetails: expect.objectContaining({
        keys,
        paths: ['plugins/a/SKILL.md', 'plugins/b/SKILL.md']
      })
    });
  });

  it('notices a deleted branch when woken early by a webhook', async () => {
    let sync = addSync({
      nextPollAt: new Date(Date.now() + 10 * 60_000),
      waitingReason: 'rate_limited'
    });
    h.provider.getRepositorySyncBranchShaOrNull.mockResolvedValue(null);

    await syncContents({ syncId: sync.id });

    expect(sync).toMatchObject({ status: 'cancelled', endReason: 'branch_deleted' });
  });

  describe('branch lineage', () => {
    it.each([
      ["started from someone else's commit", lineage('reviewer_push', 'own_2'), 'own_2'],
      [
        'saw the head move mid-slice',
        { ...lineage('own', 'own_2'), foreignCommits: true },
        'own_2'
      ],
      ['found a foreign head and wrote nothing', lineage('reviewer_push'), 'own']
    ])('flags foreign commits when a slice %s', async (_label, sliceLineage, lastPushed) => {
      let sync = addSync({ lastPushedCommitSha: 'own' });
      h.exportManifest.mockResolvedValue(
        exportResult({ partial: true, lineage: sliceLineage, newRemoteState: remote('live') })
      );

      await syncContents({ syncId: sync.id });

      expect(sync).toMatchObject({
        lastPushedCommitSha: lastPushed,
        foreignCommitsOnBranch: true
      });
    });

    it('never takes the cached remote head as its own commit', async () => {
      let sync = addSync({ lastPushedCommitSha: 'own' });
      h.exportManifest.mockResolvedValue(
        exportResult({ lineage: lineage('own'), newRemoteState: remote('someone_else') })
      );

      await syncContents({ syncId: sync.id });

      expect(sync).toMatchObject({
        status: 'creating_pr',
        lastPushedCommitSha: 'own',
        foreignCommitsOnBranch: false
      });
    });

    it('keeps the flag once set', async () => {
      let sync = addSync({ lastPushedCommitSha: 'own', foreignCommitsOnBranch: true });
      h.exportManifest.mockResolvedValue(
        exportResult({ commitsCreated: 1, lineage: lineage('own', 'own_2') })
      );

      await syncContents({ syncId: sync.id });

      expect(sync).toMatchObject({
        lastPushedCommitSha: 'own_2',
        foreignCommitsOnBranch: true
      });
    });

    it('records commits a failed slice made before it failed', async () => {
      let sync = addSync({ lastPushedCommitSha: 'own' });
      h.exportManifest.mockRejectedValue(
        exportError({
          code: 'rate_limited',
          commitsCreated: 1,
          startHeadSha: 'own',
          lastCommitSha: 'own_2',
          writeRequests: 3,
          stats: { commitsCreated: 1 }
        })
      );

      await syncContents({ syncId: sync.id });

      expect(sync).toMatchObject({
        waitingReason: 'rate_limited',
        lastPushedCommitSha: 'own_2',
        foreignCommitsOnBranch: false
      });
      expect(h.limiter.release).toHaveBeenCalledWith(
        expect.objectContaining({ granted: 30, used: 3 })
      );
    });
  });

  describe('slices without progress', () => {
    let stalled = () => exportResult({ partial: true, writeRequests: 0 });

    it('fails with no_progress after ten partial slices in a row that wrote nothing', async () => {
      let sync = addSync({ attemptCount: 1 });
      h.exportManifest.mockResolvedValue(stalled());

      for (let slice = 0; slice < 9; slice++) await syncContents({ syncId: sync.id });
      expect(sync).toMatchObject({ status: 'syncing_contents', noProgressSliceCount: 9 });

      await syncContents({ syncId: sync.id });

      expect(h.exportManifest).toHaveBeenCalledTimes(10);
      expect(sync).toMatchObject({
        status: 'failed',
        errorCode: 'no_progress',
        attemptCount: 1,
        noProgressSliceCount: 10
      });
    });

    it.each([
      ['a commit', { commitsCreated: 1 }],
      ['a blob', { blobsCreated: 1 }],
      ['an LFS upload', { lfsUploaded: 1 }]
    ])('starts counting again after %s', async (_label, progress) => {
      let sync = addSync({ noProgressSliceCount: 9 });
      h.exportManifest.mockResolvedValueOnce(
        exportResult({ partial: true, stats: stats(progress) })
      );

      await syncContents({ syncId: sync.id });

      expect(sync).toMatchObject({ status: 'syncing_contents', noProgressSliceCount: 0 });
    });

    it('counts rate-limited partial slices too', async () => {
      let sync = addSync({ noProgressSliceCount: 9 });
      h.exportManifest.mockResolvedValue(
        exportResult({ partial: true, retryAfter: new Date(Date.now() + 60_000) })
      );

      await syncContents({ syncId: sync.id });

      expect(sync).toMatchObject({ status: 'failed', errorCode: 'no_progress' });
    });
  });

  describe('when the export limiter is unavailable', () => {
    let redisDown = () =>
      Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });

    it('waits and retries without spending an attempt', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      let sync = addSync({ attemptCount: 2 });
      h.limiter.acquire.mockRejectedValue(redisDown());

      for (let slice = 0; slice < 10; slice++) {
        advancePastPoll(sync);
        await syncContents({ syncId: sync.id });
      }

      expect(h.exportManifest).not.toHaveBeenCalled();
      expect(sync).toMatchObject({
        status: 'syncing_contents',
        waitingReason: 'provider_unavailable',
        attemptCount: 2,
        noProgressSliceCount: 0
      });
      expect(sync.nextPollAt.getTime()).toBe(Date.now() + 30_000);
      expect(contentsQueue()).toHaveBeenLastCalledWith(
        { syncId: sync.id },
        expect.objectContaining({ delay: 30_000 })
      );
    });

    it('records the wait for recovery even when the queue is down too', async () => {
      let sync = addSync();
      h.limiter.acquire.mockRejectedValue(redisDown());
      contentsQueue().mockRejectedValueOnce(redisDown());

      await syncContents({ syncId: sync.id });

      expect(sync).toMatchObject({
        status: 'syncing_contents',
        waitingReason: 'provider_unavailable',
        attemptCount: 0
      });
      expect(sync.nextPollAt).toBeInstanceOf(Date);
    });

    it('keeps the slice when the lease cannot be released', async () => {
      let sync = addSync({ lastPushedCommitSha: 'own' });
      h.limiter.release.mockRejectedValue(redisDown());
      h.exportManifest.mockResolvedValue(
        exportResult({
          commitsCreated: 1,
          lineage: lineage('own', 'own_2'),
          stats: stats({ commitsCreated: 1 })
        })
      );

      await syncContents({ syncId: sync.id });

      expect(sync).toMatchObject({ status: 'creating_pr', lastPushedCommitSha: 'own_2' });
    });
  });

  it('leaves code-bucket syncs on the legacy exporter', async () => {
    let sync = addSync({
      sourceType: 'code_bucket',
      sourceKey: null,
      codeBucketOid: 20n,
      codeBucket: { id: 'bucket_1', path: '/' },
      deletePaths: []
    });
    h.provider.getRepositorySyncBranchSha.mockResolvedValue('sha');

    await syncContents({ syncId: sync.id });

    expect(h.exportCodeBucket).toHaveBeenCalled();
    expect(h.exportManifest).not.toHaveBeenCalled();
    expect(h.limiter.acquire).not.toHaveBeenCalled();
  });
});

describe('manifest createBranch lanes', () => {
  let addPrevious = (overrides: Record<string, any> = {}) =>
    addSync({
      oid: 1n,
      status: 'waiting_for_review',
      branchName: 'metorial/skills-1',
      providerPrId: '41',
      providerPrUrl: 'https://example.test/pr/41',
      lastPushedCommitSha: 'metorial_head',
      ...overrides
    });
  let addNew = (overrides: Record<string, any> = {}) =>
    addSync({ oid: 2n, status: 'creating_branch', baseCommitSha: null, ...overrides });

  beforeEach(() => {
    h.provider.createRepositorySyncBranch.mockResolvedValue({ baseBranch: 'main' });
    h.provider.getRepositorySyncBranchSha.mockResolvedValue('fresh_base');
  });

  let expectFresh = (sync: any) => {
    expect(h.provider.createRepositorySyncBranch).toHaveBeenCalled();
    expect(sync).toMatchObject({
      status: 'syncing_contents',
      branchName: 'metorial/skills-2',
      baseCommitSha: 'fresh_base',
      lastPushedCommitSha: 'fresh_base',
      continuedFromSyncOid: null,
      providerPrId: null
    });
    expect(contentsQueue()).toHaveBeenCalledWith({ syncId: sync.id });
  };

  let expectAdopted = (
    sync: any,
    previous: any,
    d: { pr: boolean; foreign: boolean; lastPushed?: string }
  ) => {
    expect(h.provider.createRepositorySyncBranch).not.toHaveBeenCalled();
    expect(sync).toMatchObject({
      status: 'syncing_contents',
      branchName: previous.branchName,
      providerPrId: d.pr ? previous.providerPrId : null,
      providerPrUrl: d.pr ? previous.providerPrUrl : null,
      lastPushedCommitSha: d.lastPushed ?? 'metorial_head',
      foreignCommitsOnBranch: d.foreign,
      continuedFromSyncOid: previous.oid
    });
    expect(previous).toMatchObject({
      status: 'cancelled',
      endReason: 'superseded',
      supersededBySyncOid: sync.oid
    });
  };

  it('creates a fresh branch when the lane is empty', async () => {
    let sync = addNew();
    await createBranch({ syncId: sync.id });
    expectFresh(sync);
  });

  it.each(['merged', 'complete_direct_push', 'complete_no_changes'])(
    'creates a fresh branch after a %s sync',
    async status => {
      addPrevious({ status });
      let sync = addNew();
      await createBranch({ syncId: sync.id });
      expectFresh(sync);
      expect(h.provider.getRepositorySyncPullRequestState).not.toHaveBeenCalled();
    }
  );

  it('waits 30 s while the previous sync is merging', async () => {
    addPrevious({ status: 'merging' });
    let sync = addNew();

    await createBranch({ syncId: sync.id });

    expect(sync.status).toBe('creating_branch');
    expect(branchQueue()).toHaveBeenCalledWith(
      { syncId: sync.id },
      expect.objectContaining({ delay: 30_000 })
    );
    expect(h.provider.createRepositorySyncBranch).not.toHaveBeenCalled();
  });

  it.each(['merged', 'closed', 'missing'])('never reuses a %s pull request', async state => {
    let previous = addPrevious();
    let sync = addNew();
    h.provider.getRepositorySyncPullRequestState.mockResolvedValue({
      state,
      conflicting: false
    });

    await createBranch({ syncId: sync.id });

    expectFresh(sync);
    expect(previous.status).toBe('waiting_for_review');
  });

  it('closes an orphaned open PR whose branch was deleted and starts fresh', async () => {
    let previous = addPrevious();
    let sync = addNew();
    h.provider.getRepositorySyncPullRequestState.mockResolvedValue({
      state: 'open',
      conflicting: false
    });
    h.provider.getRepositorySyncBranchShaOrNull.mockResolvedValue(null);

    await createBranch({ syncId: sync.id });

    expect(h.provider.closeRepositorySyncPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: previous.id }),
      expect.objectContaining({ comment: expect.any(String) })
    );
    expectFresh(sync);
  });

  it('adopts a branch that has no PR yet', async () => {
    let previous = addPrevious({
      status: 'syncing_contents',
      providerPrId: null,
      providerPrUrl: null
    });
    let sync = addNew();
    h.provider.getRepositorySyncPullRequestState.mockResolvedValue(null);
    h.provider.getRepositorySyncBranchShaOrNull.mockResolvedValue('live_head');

    await createBranch({ syncId: sync.id });

    expectAdopted(sync, previous, { pr: false, foreign: true });
  });

  describe.each(['github', 'gitlab', 'bitbucket'])('on %s', provider => {
    it('adopts an open, mergeable PR', async () => {
      let previous = addPrevious({ provider });
      let sync = addNew({ provider });
      h.provider.getRepositorySyncPullRequestState.mockResolvedValue({
        state: 'open',
        conflicting: false
      });
      h.provider.getRepositorySyncBranchShaOrNull.mockResolvedValue('metorial_head');

      await createBranch({ syncId: sync.id });

      expectAdopted(sync, previous, { pr: true, foreign: false });
    });

    it('adopts an open PR with foreign commits that does not conflict', async () => {
      let previous = addPrevious({ provider, lastPushedCommitSha: 'metorial_head' });
      let sync = addNew({ provider });
      h.provider.getRepositorySyncPullRequestState.mockResolvedValue({
        state: 'open',
        conflicting: false
      });
      h.provider.getRepositorySyncBranchShaOrNull.mockResolvedValue('live_head');

      await createBranch({ syncId: sync.id });

      expectAdopted(sync, previous, { pr: true, foreign: true });
      expect(h.provider.resetRepositorySyncBranch).not.toHaveBeenCalled();
    });

    it('carries foreign commits seen by the previous sync into the adopted lane', async () => {
      let previous = addPrevious({ provider, foreignCommitsOnBranch: true });
      let sync = addNew({ provider });
      h.provider.getRepositorySyncPullRequestState.mockResolvedValue({
        state: 'open',
        conflicting: false
      });
      h.provider.getRepositorySyncBranchShaOrNull.mockResolvedValue('metorial_head');

      await createBranch({ syncId: sync.id });

      expectAdopted(sync, previous, { pr: true, foreign: true });
    });

    it('replaces a conflicting PR whose own head sits on top of foreign commits', async () => {
      let previous = addPrevious({ provider, foreignCommitsOnBranch: true });
      let sync = addNew({ provider });
      h.provider.getRepositorySyncPullRequestState.mockResolvedValue({
        state: 'open',
        conflicting: true
      });
      h.provider.getRepositorySyncBranchShaOrNull.mockResolvedValue('metorial_head');

      await createBranch({ syncId: sync.id });

      expectFresh(sync);
      expect(h.provider.resetRepositorySyncBranch).not.toHaveBeenCalled();
      expect(previous).toMatchObject({ status: 'cancelled', supersededBySyncOid: sync.oid });
    });

    it('replaces a conflicting PR that has foreign commits', async () => {
      let previous = addPrevious({ provider });
      let sync = addNew({ provider });
      h.provider.getRepositorySyncPullRequestState.mockResolvedValue({
        state: 'open',
        conflicting: true
      });
      h.provider.getRepositorySyncBranchShaOrNull.mockResolvedValue('someone_else');

      await createBranch({ syncId: sync.id });

      expectFresh(sync);
      expect(h.provider.resetRepositorySyncBranch).not.toHaveBeenCalled();
      expect(previous).toMatchObject({
        status: 'cancelled',
        endReason: 'superseded',
        supersededBySyncOid: sync.oid
      });
    });
  });

  it('resets a conflicting Metorial-only branch on GitHub and keeps the PR', async () => {
    let previous = addPrevious({ provider: 'github' });
    let sync = addNew({ provider: 'github' });
    h.provider.getRepositorySyncPullRequestState.mockResolvedValue({
      state: 'open',
      conflicting: true
    });
    h.provider.getRepositorySyncBranchShaOrNull.mockResolvedValue('metorial_head');
    h.provider.resetRepositorySyncBranch.mockResolvedValue({
      status: 'reset',
      sha: 'reset_commit'
    });

    await createBranch({ syncId: sync.id });

    expect(h.provider.resetRepositorySyncBranch).toHaveBeenCalledWith(
      expect.objectContaining({ id: previous.id }),
      { expectedSha: 'metorial_head', baseSha: 'fresh_base' }
    );
    expectAdopted(sync, previous, { pr: true, foreign: false, lastPushed: 'reset_commit' });
    expect(sync.baseCommitSha).toBe('fresh_base');
  });

  it.each(['moved', 'rejected', 'unsupported'])(
    'replaces a conflicting branch when the reset is %s',
    async status => {
      let previous = addPrevious({ provider: 'github' });
      let sync = addNew({ provider: 'github' });
      h.provider.getRepositorySyncPullRequestState.mockResolvedValue({
        state: 'open',
        conflicting: true
      });
      h.provider.getRepositorySyncBranchShaOrNull.mockResolvedValue('metorial_head');
      h.provider.resetRepositorySyncBranch.mockResolvedValue({ status });

      await createBranch({ syncId: sync.id });

      expectFresh(sync);
      expect(previous).toMatchObject({ status: 'cancelled', supersededBySyncOid: sync.oid });
    }
  );

  it('opens a new PR instead of resetting after a reviewer pushed to an adopted PR', async () => {
    addPrevious({ provider: 'github' });
    let adopted = addNew({ provider: 'github' });
    h.provider.getRepositorySyncPullRequestState.mockResolvedValue({
      state: 'open',
      conflicting: false
    });
    h.provider.getRepositorySyncBranchShaOrNull.mockResolvedValue('metorial_head');

    await createBranch({ syncId: adopted.id });
    expect(adopted).toMatchObject({
      providerPrId: '41',
      lastPushedCommitSha: 'metorial_head',
      foreignCommitsOnBranch: false
    });

    h.exportManifest.mockResolvedValue(
      exportResult({
        commitsCreated: 1,
        writeRequests: 1,
        lineage: lineage('reviewer_push', 'metorial_head_2'),
        stats: stats({ commitsCreated: 1 })
      })
    );
    await syncContents({ syncId: adopted.id });
    expect(adopted).toMatchObject({
      status: 'creating_pr',
      lastPushedCommitSha: 'metorial_head_2',
      foreignCommitsOnBranch: true
    });
    adopted.status = 'waiting_for_review';

    let next = addSync({
      oid: 3n,
      status: 'creating_branch',
      baseCommitSha: null,
      provider: 'github'
    });
    h.provider.getRepositorySyncPullRequestState.mockResolvedValue({
      state: 'open',
      conflicting: true
    });
    h.provider.getRepositorySyncBranchShaOrNull.mockResolvedValue('metorial_head_2');

    await createBranch({ syncId: next.id });

    expect(h.provider.resetRepositorySyncBranch).not.toHaveBeenCalled();
    expect(next).toMatchObject({
      status: 'syncing_contents',
      branchName: 'metorial/skills-3',
      providerPrId: null,
      continuedFromSyncOid: null,
      foreignCommitsOnBranch: false
    });
    expect(adopted).toMatchObject({
      status: 'cancelled',
      endReason: 'superseded',
      supersededBySyncOid: 3n
    });

    next.status = 'creating_pr';
    h.provider.createRepositorySyncPullRequest.mockResolvedValue({
      providerPrId: '44',
      providerPrUrl: 'https://example.test/pr/44'
    });
    await createPr({ syncId: next.id });

    expect(h.provider.closeRepositorySyncPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: adopted.id }),
      { comment: 'Metorial continued this update in https://example.test/pr/44.' }
    );
  });

  it.each(['gitlab', 'bitbucket'])(
    'replaces a conflicting Metorial-only branch on %s (no ref reset available)',
    async provider => {
      let previous = addPrevious({ provider });
      let sync = addNew({ provider });
      h.provider.getRepositorySyncPullRequestState.mockResolvedValue({
        state: 'open',
        conflicting: true
      });
      h.provider.getRepositorySyncBranchShaOrNull.mockResolvedValue('metorial_head');
      h.provider.resetRepositorySyncBranch.mockResolvedValue({ status: 'unsupported' });

      await createBranch({ syncId: sync.id });

      expectFresh(sync);
      expect(previous).toMatchObject({ status: 'cancelled', supersededBySyncOid: sync.oid });
    }
  );

  it('waits when the previous sync moves on before it can be claimed', async () => {
    let previous = addPrevious();
    let sync = addNew();
    h.provider.getRepositorySyncPullRequestState.mockImplementation(async () => {
      previous.status = 'merging';
      return { state: 'open', conflicting: false };
    });
    h.provider.getRepositorySyncBranchShaOrNull.mockResolvedValue('live_head');

    await createBranch({ syncId: sync.id });

    expect(sync).toMatchObject({ status: 'creating_branch', continuedFromSyncOid: null });
    expect(branchQueue()).toHaveBeenCalledWith(
      { syncId: sync.id },
      expect.objectContaining({ delay: 30_000 })
    );
  });

  it('adopts the PR of a failed sync without rewriting its outcome', async () => {
    let previous = addPrevious({ status: 'failed' });
    let sync = addNew();
    h.provider.getRepositorySyncPullRequestState.mockResolvedValue({
      state: 'open',
      conflicting: false
    });
    h.provider.getRepositorySyncBranchShaOrNull.mockResolvedValue('live_head');

    await createBranch({ syncId: sync.id });

    expect(previous).toMatchObject({ status: 'failed', supersededBySyncOid: sync.oid });
    expect(sync).toMatchObject({ branchName: previous.branchName, providerPrId: '41' });
  });

  it('only considers syncs from the same source and base branch', async () => {
    addPrevious({ sourceKey: 'marketplace:other' });
    addPrevious({ oid: 3n, id: 'sync_other_base', baseBranch: 'develop' });
    let sync = addNew({ oid: 4n, id: 'sync_4', branchName: 'metorial/skills-2' });

    await createBranch({ syncId: sync.id });

    expectFresh(sync);
    expect(h.provider.getRepositorySyncPullRequestState).not.toHaveBeenCalled();
  });

  it('does not re-run lane selection when the branch was already prepared', async () => {
    addPrevious();
    let sync = addNew({ baseCommitSha: 'recorded' });

    await createBranch({ syncId: sync.id });

    expect(h.provider.getRepositorySyncPullRequestState).not.toHaveBeenCalled();
    expect(h.provider.createRepositorySyncBranch).not.toHaveBeenCalled();
    expect(sync.status).toBe('syncing_contents');
  });

  it('records the default branch head for manifest direct pushes', async () => {
    let sync = addNew({ repositoryAccessMode: 'default_branch', branchName: 'main' });
    h.provider.prepareRepositorySyncDefaultBranch.mockResolvedValue({ baseBranch: 'trunk' });
    h.provider.getRepositorySyncBranchSha.mockResolvedValue('trunk_head');

    await createBranch({ syncId: sync.id });

    expect(sync).toMatchObject({
      status: 'syncing_contents',
      baseBranch: 'trunk',
      branchName: 'trunk',
      baseCommitSha: 'trunk_head'
    });
  });
});

describe('manifest createPr', () => {
  it('updates an adopted PR instead of creating one', async () => {
    let sync = addSync({
      status: 'creating_pr',
      providerPrId: '41',
      providerPrUrl: 'https://example.test/pr/41',
      continuedFromSyncOid: 1n
    });

    await createPr({ syncId: sync.id });

    expect(h.provider.updateRepositorySyncPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: sync.id })
    );
    expect(h.provider.createRepositorySyncPullRequest).not.toHaveBeenCalled();
    expect(sync).toMatchObject({ status: 'waiting_for_ci', providerPrId: '41' });
    expect(ciQueue()).toHaveBeenCalledWith({ syncId: sync.id });
  });

  it('leaves an adopted PR for review when auto-merge is off', async () => {
    let sync = addSync({ status: 'creating_pr', providerPrId: '41', enableAutoMerge: false });

    await createPr({ syncId: sync.id });

    expect(sync.status).toBe('waiting_for_review');
    expect(ciQueue()).not.toHaveBeenCalled();
  });

  it('closes the replaced PR with a link to the new one', async () => {
    let previous = addSync({
      oid: 1n,
      status: 'cancelled',
      endReason: 'superseded',
      providerPrId: '41',
      supersededBySyncOid: 2n
    });
    let sync = addSync({ oid: 2n, status: 'creating_pr' });
    h.provider.createRepositorySyncPullRequest.mockResolvedValue({
      providerPrId: '43',
      providerPrUrl: 'https://example.test/pr/43'
    });

    await createPr({ syncId: sync.id });

    expect(h.provider.closeRepositorySyncPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: previous.id }),
      { comment: 'Metorial continued this update in https://example.test/pr/43.' }
    );
    expect(sync).toMatchObject({ status: 'waiting_for_ci', providerPrId: '43' });
  });

  it('does not close other open lane PRs the way code-bucket syncs do', async () => {
    addSync({ oid: 1n, status: 'waiting_for_review', providerPrId: '41' });
    let sync = addSync({ oid: 2n, status: 'creating_pr' });
    h.provider.createRepositorySyncPullRequest.mockResolvedValue({
      providerPrId: '43',
      providerPrUrl: 'u'
    });

    await createPr({ syncId: sync.id });

    expect(h.provider.closeRepositorySyncPullRequest).not.toHaveBeenCalled();
  });

  it('marks itself superseded when a newer manifest sync exists', async () => {
    let sync = addSync({ oid: 1n, status: 'creating_pr' });
    addSync({ oid: 2n, status: 'pending' });

    await createPr({ syncId: sync.id });

    expect(sync).toMatchObject({
      status: 'cancelled',
      endReason: 'superseded',
      supersededBySyncOid: 2n
    });
  });

  it('keeps closing older PRs for code-bucket syncs', async () => {
    let codeBucket = { sourceType: 'code_bucket', sourceKey: null, codeBucketOid: 20n };
    let older = addSync({
      ...codeBucket,
      oid: 1n,
      status: 'waiting_for_review',
      providerPrId: '41'
    });
    addSync({ oid: 2n, status: 'waiting_for_review', providerPrId: '50' });
    let sync = addSync({ ...codeBucket, oid: 3n, status: 'creating_pr' });
    h.provider.closeRepositorySyncPullRequest.mockResolvedValue('closed');
    h.provider.createRepositorySyncPullRequest.mockResolvedValue({
      providerPrId: '43',
      providerPrUrl: 'u'
    });

    await createPr({ syncId: sync.id });

    expect(h.provider.closeRepositorySyncPullRequest).toHaveBeenCalledTimes(1);
    expect(h.provider.closeRepositorySyncPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: older.id })
    );
    expect(older.status).toBe('cancelled');
    expect(older.endReason).toBeNull();
  });
});

describe('manifest dismissals while waiting', () => {
  let snapshot = (state: string) => ({
    pullRequest: { state },
    checks: { state: 'pending' },
    review: { state: 'none' },
    mergeability: { state: 'unknown' }
  });

  it.each([['pull_request_closed'], ['branch_deleted']])(
    'records %s when the PR is closed',
    async endReason => {
      let sync = addSync({ status: 'waiting_for_review', providerPrId: '42' });
      h.provider.getRepositorySyncStatusSnapshot.mockResolvedValue(snapshot('closed'));
      h.provider.getRepositorySyncDismissal.mockResolvedValue(endReason);

      await waitForCi({ syncId: sync.id });

      expect(sync).toMatchObject({ status: 'cancelled', endReason });
    }
  );

  it('records pull_request_deleted when the PR returns 404', async () => {
    let sync = addSync({ status: 'waiting_for_ci', providerPrId: '42' });
    h.provider.getRepositorySyncStatusSnapshot.mockRejectedValue({ status: 404 });
    h.provider.getRepositorySyncDismissal.mockResolvedValue('pull_request_deleted');

    await waitForCi({ syncId: sync.id });

    expect(sync).toMatchObject({ status: 'cancelled', endReason: 'pull_request_deleted' });
  });

  it.each([
    ['gitlab', 'gitlab'],
    ['bitbucket', 'bitbucket'],
    ['bitbucket', 'bitbucket_data_center']
  ])(
    'notices a %s (%s) PR left open after its branch was deleted',
    async (provider, backendType) => {
      let sync = addSync({
        status: 'waiting_for_review',
        providerPrId: '42',
        provider,
        backendType
      });
      h.provider.getRepositorySyncStatusSnapshot.mockResolvedValue(snapshot('open'));
      h.provider.getRepositorySyncBranchShaOrNull.mockResolvedValue(null);

      await waitForCi({ syncId: sync.id });

      expect(h.provider.getRepositorySyncBranchShaOrNull).toHaveBeenCalledWith(
        expect.objectContaining({ id: sync.id }),
        sync.branchName
      );
      expect(sync).toMatchObject({ status: 'cancelled', endReason: 'branch_deleted' });
    }
  );

  it('relies on GitHub closing the PR instead of checking the branch', async () => {
    let sync = addSync({ status: 'waiting_for_review', providerPrId: '42' });
    h.provider.getRepositorySyncStatusSnapshot.mockResolvedValue(snapshot('open'));
    h.classify.mockReturnValue('waiting_for_review');

    await waitForCi({ syncId: sync.id });

    expect(h.provider.getRepositorySyncBranchShaOrNull).not.toHaveBeenCalled();
    expect(sync.status).not.toBe('cancelled');
  });

  it('keeps code-bucket cancellations without an end reason', async () => {
    let sync = addSync({
      status: 'waiting_for_review',
      providerPrId: '42',
      sourceType: 'code_bucket',
      codeBucketOid: 20n
    });
    h.provider.getRepositorySyncStatusSnapshot.mockResolvedValue(snapshot('closed'));

    await waitForCi({ syncId: sync.id });

    expect(sync).toMatchObject({ status: 'cancelled', endReason: null });
    expect(h.provider.getRepositorySyncDismissal).not.toHaveBeenCalled();
  });

  it('records the end reason when the PR closes right before merging', async () => {
    let sync = addSync({ status: 'merging', providerPrId: '42' });
    h.provider.getRepositorySyncStatusSnapshot.mockResolvedValue(snapshot('closed'));
    h.provider.getRepositorySyncDismissal.mockResolvedValue('pull_request_closed');

    await merge({ syncId: sync.id });

    expect(sync).toMatchObject({ status: 'cancelled', endReason: 'pull_request_closed' });
  });
});
