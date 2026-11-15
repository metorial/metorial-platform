import { beforeEach, describe, expect, it, vi } from 'vitest';

let h = vi.hoisted(() => {
  let queues: Record<string, { add: ReturnType<typeof vi.fn> }> = {};
  return {
    findMany: vi.fn(),
    cron: undefined as undefined | (() => Promise<void>),
    queues,
    queue: (name: string) => (queues[name] = { add: vi.fn() })
  };
});

vi.mock('../../../db', () => ({ db: { scmRepositorySync: { findMany: h.findMany } } }));
vi.mock('../../../env', () => ({ env: { service: { REDIS_URL: 'redis://unused' } } }));
vi.mock('@lowerdeck/cron', () => ({
  createCron: (_opts: unknown, run: () => Promise<void>) => {
    h.cron = run;
    return run;
  }
}));
vi.mock('./createBranch', () => ({ createBranchRepositorySyncQueue: h.queue('branch') }));
vi.mock('./createPr', () => ({ createPrRepositorySyncQueue: h.queue('pr') }));
vi.mock('./merge', () => ({ mergeRepositorySyncQueue: h.queue('merge') }));
vi.mock('./start', () => ({ startRepositorySyncQueue: h.queue('start') }));
vi.mock('./syncContents', () => ({ syncContentsRepositorySyncQueue: h.queue('contents') }));
vi.mock('./waitForCi', () => ({ waitForCiRepositorySyncQueue: h.queue('ci') }));

import { accelerateRepositorySyncsForProviderEvent } from './recover';

beforeEach(() => vi.clearAllMocks());

describe('repository sync recovery', () => {
  it('does not wake manifest slices that are deliberately waiting', async () => {
    h.findMany.mockResolvedValue([]);
    await h.cron!();

    let staleClause = h.findMany.mock.calls[0]![0].where.OR[1];
    expect(staleClause.NOT).toEqual({
      sourceType: 'manifest',
      status: 'syncing_contents',
      nextPollAt: { gt: expect.any(Date) }
    });
  });
});

describe('provider event acceleration', () => {
  it('keeps PR events limited to waiting and merging syncs', async () => {
    h.findMany.mockResolvedValue([{ id: 'a', status: 'waiting_for_ci' }]);

    await accelerateRepositorySyncsForProviderEvent({
      repoOid: 10n,
      providerPrId: '42',
      idempotencyKey: 'delivery'
    });

    expect(h.findMany.mock.calls[0]![0].where).toEqual({
      repoOid: 10n,
      status: { in: ['waiting_for_ci', 'waiting_for_review', 'merging'] },
      providerPrId: '42'
    });
    expect(h.queues.ci!.add).toHaveBeenCalledWith(
      { syncId: 'a' },
      { id: 'a:webhook:delivery' }
    );
  });

  it('wakes every active manifest sync on a deleted branch', async () => {
    h.findMany.mockResolvedValue([
      { id: 'writing', status: 'syncing_contents' },
      { id: 'review', status: 'waiting_for_review' },
      { id: 'merging', status: 'merging' }
    ]);

    await accelerateRepositorySyncsForProviderEvent({
      repoOid: 10n,
      deletedBranchName: 'metorial/skills-1',
      idempotencyKey: 'delivery:deleted'
    });

    expect(h.findMany.mock.calls[0]![0].where).toEqual({
      repoOid: 10n,
      sourceType: 'manifest',
      repositoryAccessMode: 'pull_request',
      branchName: 'metorial/skills-1',
      status: { in: ['syncing_contents', 'waiting_for_ci', 'waiting_for_review', 'merging'] }
    });
    expect(h.queues.contents!.add).toHaveBeenCalledWith(
      { syncId: 'writing' },
      { id: 'writing:webhook:delivery:deleted' }
    );
    expect(h.queues.ci!.add).toHaveBeenCalledWith(
      { syncId: 'review' },
      { id: 'review:webhook:delivery:deleted' }
    );
    expect(h.queues.merge!.add).toHaveBeenCalledWith(
      { syncId: 'merging' },
      { id: 'merging:webhook:delivery:deleted' }
    );
  });
});
