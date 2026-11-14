import { beforeEach, describe, expect, it, vi } from 'vitest';

let { findFirst, findUniqueOrThrow, snapshot, dismissal, transition } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  snapshot: vi.fn(),
  dismissal: vi.fn(),
  transition: vi.fn()
}));

vi.mock('../db', () => ({ db: { scmRepositorySync: { findFirst, findUniqueOrThrow } } }));
vi.mock('../id', () => ({ getId: vi.fn() }));
vi.mock('@lowerdeck/service', () => ({
  Service: { create: (_name: string, factory: () => unknown) => ({ build: factory }) }
}));
vi.mock('../queues/scm/repositorySync/start', () => ({ startRepositorySyncQueue: {} }));
vi.mock('../queues/scm/repositorySync/merge', () => ({ mergeRepositorySyncQueue: {} }));
vi.mock('../queues/scm/repositorySync/waitForCi', () => ({
  waitForCiRepositorySyncQueue: {}
}));
vi.mock('../lib/scmRepositorySyncProvider', () => ({
  getRepositorySyncDismissal: dismissal,
  getRepositorySyncStatusSnapshot: snapshot
}));
vi.mock('./repositorySyncState', async importOriginal => ({
  ...(await importOriginal<typeof import('./repositorySyncState')>()),
  transitionRepositorySyncState: transition
}));

import { scmRepositorySyncService } from './scmRepositorySync';

describe('terminal repository status checks', () => {
  beforeEach(() => vi.resetAllMocks());

  it.each([
    'cancelled',
    'failed',
    'merged',
    'complete_no_changes',
    'complete_direct_push',
    'complete_unmerged'
  ])('does not revive %s work when an old pull request still exists', async status => {
    let sync = {
      id: 'sync',
      status,
      providerPrId: 'pr',
      providerPrUrl: 'https://example.test/pr'
    };
    findFirst.mockResolvedValue(sync);

    let result = await scmRepositorySyncService.checkScmRepositorySyncStatus({
      tenant: { oid: 1n } as never,
      id: 'sync'
    });

    expect(result).toBe(sync);
    expect(snapshot).not.toHaveBeenCalled();
    expect(transition).not.toHaveBeenCalled();
  });
});

describe('manifest repository status checks', () => {
  beforeEach(() => vi.resetAllMocks());

  it.each(['creating_branch', 'syncing_contents', 'creating_pr'])(
    'leaves an adopted PR alone while the sync is still %s',
    async status => {
      let sync = {
        id: 'sync',
        status,
        sourceType: 'manifest',
        providerPrId: 'pr',
        providerPrUrl: 'https://example.test/pr'
      };
      findFirst.mockResolvedValue(sync);

      await expect(
        scmRepositorySyncService.checkScmRepositorySyncStatus({
          tenant: { oid: 1n } as never,
          id: 'sync'
        })
      ).resolves.toBe(sync);
      expect(snapshot).not.toHaveBeenCalled();
    }
  );

  it('records why a manifest PR was dismissed', async () => {
    findFirst.mockResolvedValue({
      id: 'sync',
      status: 'waiting_for_review',
      sourceType: 'manifest',
      providerPrId: 'pr',
      providerPrUrl: 'https://example.test/pr',
      enableAutoMerge: false
    });
    snapshot.mockResolvedValue({
      pullRequest: { state: 'closed' },
      checks: { state: 'unknown' },
      review: { state: 'none' },
      mergeability: { state: 'unknown' }
    });
    dismissal.mockResolvedValue('branch_deleted');
    transition.mockResolvedValue({});
    findUniqueOrThrow.mockResolvedValue({ id: 'sync' });

    await scmRepositorySyncService.checkScmRepositorySyncStatus({
      tenant: { oid: 1n } as never,
      id: 'sync'
    });

    expect(transition).toHaveBeenCalledWith(
      'sync',
      'waiting_for_review',
      expect.objectContaining({ status: 'cancelled', endReason: 'branch_deleted' })
    );
  });
});
