import { beforeEach, describe, expect, it, vi } from 'vitest';

let { findFirst, snapshot, transition } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  snapshot: vi.fn(),
  transition: vi.fn()
}));

vi.mock('../db', () => ({ db: { scmRepositorySync: { findFirst } } }));
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
