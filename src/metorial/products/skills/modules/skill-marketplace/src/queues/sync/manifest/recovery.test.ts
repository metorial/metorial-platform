import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, forceSkillDestinationSync } = vi.hoisted(() => ({
  db: {
    skillDestinationSync: { findFirst: vi.fn(), count: vi.fn() },
    skillDestinationFile: { findMany: vi.fn() },
    skillDestinationItem: { updateMany: vi.fn() },
    skillRepository: { findUniqueOrThrow: vi.fn(), update: vi.fn() }
  },
  forceSkillDestinationSync: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db,
  withTransaction: async (run: (client: typeof db) => unknown) => await run(db)
}));
vi.mock('../../../env', () => ({
  env: {
    skillSync: {
      SKILL_SYNC_SOURCE_NOT_FOUND_MAX_RECOVERIES: 3,
      SKILL_SYNC_SOURCE_RECOVERY_EXHAUSTED_AFTER: 3
    }
  }
}));
vi.mock('../../../lib/destinationSync', () => ({ forceSkillDestinationSync }));

import {
  getSourceRecoveryKeys,
  recordSourceRecoveryLimitReached,
  recoverMissingManifestSources
} from './recovery';

let recovery = { id: 'skds_recovery', oid: 12n };

describe('source_not_found recovery', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.skillDestinationSync.findFirst.mockResolvedValue(null);
    db.skillDestinationSync.count.mockResolvedValue(0);
    db.skillDestinationFile.findMany.mockResolvedValue([]);
    forceSkillDestinationSync.mockResolvedValue(recovery);
  });

  it('re-applies only the items whose files went missing and starts a recovery sync', async () => {
    db.skillDestinationFile.findMany.mockResolvedValue([
      { itemKey: 'skill:skl_1:skplg_1' },
      { itemKey: 'skill:skl_1:skplg_1' },
      { itemKey: 'marketplace:skmkt_1' },
      { itemKey: null }
    ]);

    expect(
      await recoverMissingManifestSources({
        destinationOid: 5n,
        afterSyncOid: 10n,
        keys: ['blob/abc']
      })
    ).toEqual({ status: 'started', sync: recovery });

    expect(db.skillDestinationFile.findMany).toHaveBeenCalledWith({
      where: { destinationOid: 5n, sourceKey: { in: ['blob/abc'] } },
      select: { itemKey: true }
    });
    expect(db.skillDestinationItem.updateMany).toHaveBeenCalledWith({
      where: {
        destinationOid: 5n,
        OR: [
          { skill: { id: 'skl_1' }, skillPlugin: { id: 'skplg_1' } },
          { skillMarketplace: { id: 'skmkt_1' }, skillPluginOid: null, skillOid: null }
        ]
      },
      data: { hash: '' }
    });
    expect(forceSkillDestinationSync).toHaveBeenCalledWith({
      destination: { oid: 5n },
      trigger: 'recovery'
    });
  });

  it('re-applies every item when no keys are known', async () => {
    await recoverMissingManifestSources({ destinationOid: 5n });

    expect(db.skillDestinationFile.findMany).not.toHaveBeenCalled();
    expect(db.skillDestinationItem.updateMany).toHaveBeenCalledWith({
      where: { destinationOid: 5n },
      data: { hash: '' }
    });
  });

  it('re-applies every item when the missing keys belong to no item', async () => {
    db.skillDestinationFile.findMany.mockResolvedValue([{ itemKey: null }]);

    await recoverMissingManifestSources({
      destinationOid: 5n,
      keys: ['skill-sync/manifests/d/sha.ndjson']
    });

    expect(db.skillDestinationItem.updateMany).toHaveBeenCalledWith({
      where: { destinationOid: 5n },
      data: { hash: '' }
    });
  });

  it('starts at most three recoveries per destination per day', async () => {
    db.skillDestinationSync.count.mockResolvedValue(3);

    expect(await recoverMissingManifestSources({ destinationOid: 5n, keys: ['x'] })).toEqual({
      status: 'limit_reached'
    });
    expect(db.skillDestinationSync.count).toHaveBeenCalledWith({
      where: {
        destinationOid: 5n,
        trigger: 'recovery',
        createdAt: { gte: expect.any(Date) }
      }
    });
    expect(db.skillDestinationItem.updateMany).not.toHaveBeenCalled();
    expect(forceSkillDestinationSync).not.toHaveBeenCalled();
  });

  it('reuses a recovery that already started after the failing sync', async () => {
    db.skillDestinationSync.findFirst.mockResolvedValue({ id: 'skds_11', oid: 11n });

    expect(
      await recoverMissingManifestSources({ destinationOid: 5n, afterSyncOid: 10n })
    ).toEqual({ status: 'already_started', sync: { id: 'skds_11', oid: 11n } });
    expect(db.skillDestinationSync.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { destinationOid: 5n, trigger: 'recovery', oid: { gt: 10n } }
      })
    );
    expect(forceSkillDestinationSync).not.toHaveBeenCalled();
  });

  it('does not look for an earlier recovery without a failing sync to compare against', async () => {
    await recoverMissingManifestSources({ destinationOid: 5n });

    expect(db.skillDestinationSync.findFirst).not.toHaveBeenCalled();
    expect(forceSkillDestinationSync).toHaveBeenCalledOnce();
  });
});

describe('source recovery limit windows', () => {
  let hour = 60 * 60 * 1000;
  let now = new Date('2026-11-08T12:00:00Z');
  let state = {
    sourceRecoveryLimitWindows: 0,
    sourceRecoveryLimitReachedAt: null as Date | null
  };

  let hitAt = async (hoursLater: number) =>
    await recordSourceRecoveryLimitReached({
      skillRepositoryOid: 1n,
      now: new Date(now.getTime() + hoursLater * hour)
    });

  beforeEach(() => {
    vi.resetAllMocks();
    state = { sourceRecoveryLimitWindows: 0, sourceRecoveryLimitReachedAt: null };
    db.skillRepository.findUniqueOrThrow.mockImplementation(async () => ({ ...state }));
    db.skillRepository.update.mockImplementation(async ({ data }: any) => {
      Object.assign(state, data);
    });
  });

  it('counts each consecutive 24-hour window once and is exhausted on the third', async () => {
    expect(await hitAt(0)).toEqual({ windows: 1, exhausted: false });
    expect(await hitAt(6)).toEqual({ windows: 1, exhausted: false });
    expect(await hitAt(25)).toEqual({ windows: 2, exhausted: false });
    expect(await hitAt(30)).toEqual({ windows: 2, exhausted: false });
    expect(await hitAt(50)).toEqual({ windows: 3, exhausted: true });
    expect(db.skillRepository.update).toHaveBeenCalledTimes(3);
  });

  it('starts over after a full window without hitting the limit', async () => {
    await hitAt(0);
    await hitAt(25);

    expect(await hitAt(25 + 49)).toEqual({ windows: 1, exhausted: false });
  });

  it('reads the single key content_mismatch reports', () => {
    expect(getSourceRecoveryKeys({ key: 'blob/a', path: 'a.md' })).toEqual(['blob/a']);
    expect(getSourceRecoveryKeys({ keys: ['blob/b'], key: 'blob/a' })).toEqual(['blob/b']);
    expect(getSourceRecoveryKeys(null)).toBeUndefined();
  });
});
