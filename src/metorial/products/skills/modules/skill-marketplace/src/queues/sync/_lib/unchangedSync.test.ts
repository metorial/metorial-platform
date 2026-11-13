import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db } = vi.hoisted(() => ({
  db: {
    skillDestination: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    skillDestinationSyncRepositoryPropagation: { findFirst: vi.fn() },
    skillDestinationDeletedFile: { findFirst: vi.fn() }
  }
}));

vi.mock('@metorial/db', () => ({ db }));
vi.mock('../../../env', () => ({
  env: { skillSync: { SKILL_SYNC_DRIFT_CHECK_INTERVAL: 86400 } }
}));
vi.mock('../manifest/propagate', () => ({ shouldSkipManifestPropagation: vi.fn() }));
vi.mock('../finish', () => ({ syncFinishQueue: { add: vi.fn() } }));
vi.mock('./logs', () => ({ appendSkillDestinationSyncLog: vi.fn() }));

import {
  areCodeBucketRepositoriesCurrent,
  canSkipUnchangedSync,
  isCodeBucketRepositoryCurrent
} from './unchangedSync';

let policy = {
  repositoryAccessMode: 'pull_request' as const,
  forceMergeOrPush: false,
  mergeBeforeChecksPass: false
};

let propagation = (overrides: Record<string, unknown> = {}) =>
  ({ ...policy, status: 'completed', contentRevision: 4, ...overrides }) as any;

describe('canSkipUnchangedSync', () => {
  let automatic = { trigger: 'automatic' as const, allowMassDelete: false };

  it('allows skipping automatic syncs without changes', () => {
    expect(canSkipUnchangedSync({ sync: automatic, hasChanges: false })).toBe(true);
  });

  it('never skips syncs that changed content', () => {
    expect(canSkipUnchangedSync({ sync: automatic, hasChanges: true })).toBe(false);
  });

  it.each(['manual', 'repair', 'drift_check', 'recovery', 'migration'] as const)(
    'never skips %s syncs',
    trigger => {
      expect(
        canSkipUnchangedSync({ sync: { trigger, allowMassDelete: false }, hasChanges: false })
      ).toBe(false);
    }
  );

  it('never skips syncs allowed to mass delete or targeted at one repository', () => {
    expect(
      canSkipUnchangedSync({
        sync: { trigger: 'automatic', allowMassDelete: true },
        hasChanges: false
      })
    ).toBe(false);
    expect(
      canSkipUnchangedSync({ sync: automatic, hasChanges: false, skillRepositoryId: 'skr_1' })
    ).toBe(false);
  });
});

describe('isCodeBucketRepositoryCurrent', () => {
  let current = (latestPropagation: any, hasPendingDeletions = false) =>
    isCodeBucketRepositoryCurrent({
      contentRevision: 4,
      policy,
      latestPropagation,
      hasPendingDeletions
    });

  it('is current when the last propagation delivered this revision with the same policy', () => {
    expect(current(propagation())).toBe(true);
    expect(current(propagation({ status: 'waiting_for_review' }))).toBe(true);
    expect(current(propagation({ status: 'processing' }))).toBe(true);
  });

  it('is stale when the repository never received this revision', () => {
    expect(current(null)).toBe(false);
    expect(current(propagation({ contentRevision: 3 }))).toBe(false);
    expect(current(propagation({ contentRevision: null }))).toBe(false);
  });

  it('is stale when the last propagation did not deliver', () => {
    expect(current(propagation({ status: 'failed' }))).toBe(false);
    expect(current(propagation({ status: 'pending' }))).toBe(false);
  });

  it('is stale when the repository policy changed', () => {
    expect(current(propagation({ repositoryAccessMode: 'default_branch' }))).toBe(false);
    expect(current(propagation({ forceMergeOrPush: true }))).toBe(false);
    expect(current(propagation({ mergeBeforeChecksPass: true }))).toBe(false);
  });

  it('is stale while deletions still have to reach the repository', () => {
    expect(current(propagation(), true)).toBe(false);
  });
});

describe('areCodeBucketRepositoriesCurrent', () => {
  let mockRepositories = (repositories: { oid: bigint }[]) =>
    db.skillDestination.findUniqueOrThrow.mockResolvedValue({
      contentRevision: 4,
      skillMarketplace: {
        ...policy,
        repositories: repositories.map(skillRepository => ({
          skillRepository: { deletionsAppliedAt: new Date(), ...skillRepository }
        }))
      },
      skillPlugin: null
    });

  beforeEach(() => {
    vi.resetAllMocks();
    db.skillDestinationDeletedFile.findFirst.mockResolvedValue(null);
  });

  it('is false without linked repositories', async () => {
    mockRepositories([]);

    expect(await areCodeBucketRepositoriesCurrent(1n)).toBe(false);
  });

  it('is true when every repository received the current revision', async () => {
    mockRepositories([{ oid: 10n }, { oid: 11n }]);
    db.skillDestinationSyncRepositoryPropagation.findFirst.mockResolvedValue(propagation());

    expect(await areCodeBucketRepositoriesCurrent(1n)).toBe(true);
    expect(db.skillDestinationSyncRepositoryPropagation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          skillRepositoryOid: 11n,
          skillDestinationSync: { destinationOid: 1n },
          status: { not: 'canceled' }
        }),
        orderBy: { oid: 'desc' }
      })
    );
  });

  it('is false when any repository is behind', async () => {
    mockRepositories([{ oid: 10n }, { oid: 11n }]);
    db.skillDestinationSyncRepositoryPropagation.findFirst
      .mockResolvedValueOnce(propagation())
      .mockResolvedValueOnce(propagation({ contentRevision: 3 }));

    expect(await areCodeBucketRepositoriesCurrent(1n)).toBe(false);
  });

  it('is false when deletions are pending for a repository', async () => {
    mockRepositories([{ oid: 10n }]);
    db.skillDestinationSyncRepositoryPropagation.findFirst.mockResolvedValue(propagation());
    db.skillDestinationDeletedFile.findFirst.mockResolvedValue({ destinationOid: 1n });

    expect(await areCodeBucketRepositoriesCurrent(1n)).toBe(false);
  });
});
