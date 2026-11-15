import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  transition: vi.fn(),
  snapshot: vi.fn(),
  merge: vi.fn(),
  createPr: vi.fn(),
  classify: vi.fn(),
  captureMessage: vi.fn(),
  queues: new Map<string, { add: ReturnType<typeof vi.fn> }>()
}));

vi.mock('../../../db', () => ({
  db: {
    scmRepositorySync: {
      findFirst: mocks.findFirst,
      findUnique: mocks.findUnique,
      findMany: mocks.findMany,
      updateMany: mocks.updateMany
    }
  }
}));
vi.mock('../../../env', () => ({ env: { service: { REDIS_URL: 'unused' } } }));
vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({ captureMessage: mocks.captureMessage })
}));
vi.mock('@lowerdeck/queue', () => ({
  createQueue: ({ name }: { name: string }) => {
    let queue = { add: vi.fn(), process: (run: unknown) => run };
    mocks.queues.set(name, queue);
    return queue;
  }
}));
vi.mock('../../../lib/repositorySyncWriteLock', () => ({
  withRepositorySyncWriteLock: (run: unknown) => run
}));
vi.mock('../../../services/repositorySyncSupersession', () => ({
  cancelSupersededRepositorySync: vi.fn().mockResolvedValue(false),
  getSyncSourceScope: () => ({ repoOid: 1n })
}));
vi.mock('../../../services/repositorySyncState', () => ({
  transitionRepositorySyncState: mocks.transition,
  classifyRepositorySyncSnapshot: mocks.classify,
  claimRepositorySyncMergeAttempt: vi.fn().mockResolvedValue(true),
  isTerminalRepositorySyncStatus: () => false
}));
vi.mock('../../../lib/scmRepositorySyncProvider', () => ({
  getRepositorySyncStatusSnapshot: mocks.snapshot,
  mergeRepositorySyncPullRequest: mocks.merge,
  createRepositorySyncPullRequest: mocks.createPr,
  updateRepositorySyncPullRequest: mocks.createPr,
  getRepositorySyncDismissal: vi.fn().mockResolvedValue(null),
  getRepositorySyncBranchShaOrNull: vi.fn().mockResolvedValue('source_sha')
}));

import { mergeRepositorySyncQueueProcessor } from './merge';
import { waitForCiRepositorySyncQueueProcessor } from './waitForCi';
import { createPrRepositorySyncQueueProcessor } from './createPr';

let snapshot = {
  version: 1,
  provider: 'gitlab',
  pullRequest: { id: '42', url: 'https://gitlab.example/mr/42', state: 'open' },
  checks: { state: 'success', total: 0, successful: 0, pending: 0, failed: 0, items: [] },
  review: { state: 'not_required', approvals: 0, changesRequested: 0 },
  mergeability: { state: 'mergeable', reason: 'mergeable' },
  observedAt: new Date().toISOString()
};

let row: any;

let run = (processor: unknown) =>
  (processor as (d: { syncId: string }) => Promise<void>)({ syncId: row.id });

let messages = () =>
  mocks.updateMany.mock.calls.flatMap(([input]) => input.data.logs?.push?.[1] ?? []);

describe('repository sync retry lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    row = {
      id: 'sync_1',
      oid: 1n,
      repoOid: 1n,
      repo: { id: 'repo_1', provider: 'gitlab' },
      status: 'merging',
      sourceType: 'manifest',
      enableAutoMerge: true,
      repositoryAccessMode: 'pull_request',
      providerPrId: '42',
      providerPrUrl: 'https://gitlab.example/mr/42',
      attemptCount: 0,
      nextPollAt: null,
      errorMessage: null,
      errorCode: null,
      logs: [],
      statusSnapshot: snapshot
    };
    mocks.findFirst.mockImplementation(async ({ where }) =>
      where.repositoryAccessMode === 'default_branch' || where.oid?.gt ? null : row
    );
    mocks.findUnique.mockImplementation(async () => row);
    mocks.findMany.mockResolvedValue([]);
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.transition.mockResolvedValue({});
    mocks.snapshot.mockResolvedValue(snapshot);
    mocks.classify.mockReturnValue('merging');
    mocks.merge.mockResolvedValue({ mergeSha: 'merged_sha' });
  });

  it('retries readiness rejections with safe logs and a Sentry report', async () => {
    mocks.merge.mockRejectedValue({
      cause: { response: { status: 405 }, description: 'raw provider output' }
    });

    await run(mergeRepositorySyncQueueProcessor);

    expect(mocks.transition).toHaveBeenLastCalledWith(
      row.id,
      'merging',
      expect.objectContaining({
        status: 'waiting_for_ci',
        errorCode: 'merge_not_ready',
        mergeAttemptSnapshotHashes: [],
        errorMessage:
          "The repository isn't ready to merge yet. The sync will retry automatically.",
        nextPollAt: expect.any(Date)
      })
    );
    expect(messages()).toContain(
      "The repository isn't ready to merge yet. The sync will retry automatically."
    );
    expect(mocks.captureMessage).toHaveBeenCalledOnce();
    expect(mocks.queues.get('ori/rep-sync/wait-ci')!.add).toHaveBeenCalled();
    expect(JSON.stringify(messages())).not.toContain('raw provider output');
  });

  it('reports status lookup failures without exposing error messages', async () => {
    row.status = 'waiting_for_ci';
    mocks.snapshot.mockRejectedValue(new TypeError('internal implementation details'));

    await run(waitForCiRepositorySyncQueueProcessor);

    expect(mocks.transition).toHaveBeenCalledWith(
      row.id,
      'waiting_for_ci',
      expect.objectContaining({
        errorMessage:
          "We couldn't check the repository status. The sync will retry automatically."
      })
    );
    expect(JSON.stringify(messages())).not.toContain('internal implementation details');
    expect(mocks.captureMessage).toHaveBeenCalledOnce();
    expect(mocks.queues.get('ori/rep-sync/wait-ci')!.add).toHaveBeenCalled();
  });

  it('logs recovery and clears retries when status checks succeed', async () => {
    row.status = 'waiting_for_ci';
    row.errorMessage = 'Previous failure';
    row.errorCode = 'rate_limited';

    await run(waitForCiRepositorySyncQueueProcessor);

    expect(messages()).toContain('Repository sync resumed.');
    expect(mocks.transition).toHaveBeenCalledWith(
      row.id,
      'waiting_for_ci',
      expect.objectContaining({
        status: 'merging',
        errorMessage: null,
        errorCode: null,
        nextPollAt: null
      })
    );
    expect(mocks.queues.get('ori/rep-sync/merge')!.add).toHaveBeenCalledWith({
      syncId: row.id
    });
  });

  it('logs merge preparation as progress while waiting for readiness', async () => {
    row.status = 'waiting_for_ci';
    mocks.snapshot.mockResolvedValue({
      ...snapshot,
      mergeability: { state: 'checking', reason: 'checking' }
    });
    mocks.classify.mockReturnValue('waiting_for_ci');

    await run(waitForCiRepositorySyncQueueProcessor);

    expect(messages()).toContain('Waiting for the repository to prepare the merge.');
    expect(mocks.merge).not.toHaveBeenCalled();
    expect(mocks.captureMessage).not.toHaveBeenCalled();
  });

  it('retries transient merge request creation failures', async () => {
    row.status = 'creating_pr';
    row.providerPrId = null;
    mocks.createPr.mockRejectedValue({ cause: { response: { status: 429 } } });

    await run(createPrRepositorySyncQueueProcessor);

    expect(mocks.transition).toHaveBeenCalledWith(
      row.id,
      'creating_pr',
      expect.objectContaining({
        errorCode: 'rate_limited',
        nextPollAt: expect.any(Date),
        attemptCount: { increment: 1 }
      })
    );
    expect(mocks.captureMessage).toHaveBeenCalledOnce();
    expect(mocks.queues.get('ori/rep-sync/pr')!.add).toHaveBeenCalled();
  });

  it('clears errors and logs completion after a successful merge', async () => {
    row.errorMessage = 'Previous failure';
    row.errorCode = 'merge_not_ready';

    await run(mergeRepositorySyncQueueProcessor);

    expect(mocks.transition).toHaveBeenLastCalledWith(
      row.id,
      'merging',
      expect.objectContaining({
        status: 'merged',
        errorMessage: null,
        errorCode: null,
        nextPollAt: null
      })
    );
    expect(messages()).toContain('Repository update completed.');
  });
});
