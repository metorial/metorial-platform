import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, skill, marketplace, plugin, available, log, next } = vi.hoisted(() => ({
  db: {
    skillDestinationSync: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    skillDestinationItem: { findMany: vi.fn() },
    skillMarketplace: { findFirst: vi.fn(), findMany: vi.fn() },
    skillPlugin: { findFirst: vi.fn(), findMany: vi.fn() },
    skill: { findMany: vi.fn() }
  },
  skill: {
    applySkill: { init: vi.fn(), getHash: vi.fn() },
    loadSkillInitLookup: vi.fn(),
    getSkillInitLookupSize: vi.fn(),
    initSkillFromLookup: vi.fn()
  },
  marketplace: { init: vi.fn(async () => ({})), getHash: vi.fn(async () => 'mkt-hash') },
  plugin: { init: vi.fn(async () => ({})), getHash: vi.fn(async () => 'plugin-hash') },
  available: vi.fn(),
  log: vi.fn(),
  next: vi.fn()
}));

vi.mock('@metorial/db', () => ({ db }));
vi.mock('@metorial/queue', () => ({
  createQueue: () => ({ process: (run: unknown) => run, add: next })
}));
vi.mock('@metorial/fabric', () => ({ Fabric: { fire: vi.fn() } }));
vi.mock('@metorial/module-store', () => ({ refreshStoreByteSize: vi.fn() }));
vi.mock('@metorial/module-flags', () => ({ flagService: {} }));
vi.mock('../../serializers/marketplace', () => ({ applyMarketplace: marketplace }));
vi.mock('../../serializers/plugin', () => ({ applyPlugin: plugin }));
vi.mock('../../serializers/skill', () => skill);
vi.mock('../../lib/securityReviewPolicy', () => ({ getWithheldSkillIds: async () => new Set<string>() }));
vi.mock('./_lib/bucket', () => ({ destinationBucketIsAvailable: available }));
vi.mock('./_lib/lock', () => ({ withDestinationSyncLock: (run: unknown) => run }));
vi.mock('./_lib/logs', () => ({ appendSkillDestinationSyncLog: log }));
vi.mock('./process', () => ({ syncProcessQueue: { add: next } }));
vi.mock('./reconcile', () => ({ syncReconcileQueue: { add: next } }));

import { maxSkillDestinationFiles } from '../../lib/limits';
import { syncCollectQueueProcessor } from './collect';

let run = syncCollectQueueProcessor as unknown as (data: {
  skillDestinationSyncId: string;
}) => Promise<void>;

let skills = [
  { id: 'sk_1', storeOid: 10n },
  { id: 'sk_2', storeOid: 11n }
];

let marketplaceRecord = {
  oid: 2n,
  id: 'mkt_1',
  skillConfiguration: null,
  plugins: [
    {
      skillConfiguration: null,
      skillPlugin: {
        id: 'plg_1',
        skillConfiguration: null,
        skillPluginSkills: skills.map(skill => ({ skill, skillConfiguration: null }))
      }
    }
  ]
};

let mockSync = (storageMode: string) =>
  db.skillDestinationSync.findUnique.mockResolvedValue({
    oid: 7n,
    status: 'processing',
    isAtRepoSyncStage: false,
    destination: {
      oid: 1n,
      storageMode,
      skillMarketplace: { oid: 2n, id: 'mkt_1', name: 'Market' },
      skillPlugin: null
    }
  });

describe('collect in manifest mode', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    marketplace.init.mockResolvedValue({});
    marketplace.getHash.mockResolvedValue('mkt-hash');
    plugin.init.mockResolvedValue({});
    plugin.getHash.mockResolvedValue('plugin-hash');
    db.skillDestinationSync.update.mockResolvedValue({ contentVersion: 3 });
    db.skillDestinationItem.findMany.mockResolvedValue([]);
    db.skillMarketplace.findFirst.mockResolvedValue(marketplaceRecord);
    db.skillMarketplace.findMany.mockResolvedValue([]);
    db.skillPlugin.findMany.mockResolvedValue([]);
    db.skill.findMany.mockResolvedValue([]);
    skill.loadSkillInitLookup.mockResolvedValue({ lookup: true });
    skill.getSkillInitLookupSize.mockReturnValue({ files: 10, bytes: 100n });
    skill.initSkillFromLookup.mockResolvedValue({ init: 'batched' });
    skill.applySkill.getHash.mockResolvedValue('skill-hash');
  });

  it('hashes skills from one batched lookup without waiting on the code bucket', async () => {
    mockSync('manifest');

    await run({ skillDestinationSyncId: 'sync_1' });

    expect(available).not.toHaveBeenCalled();
    expect(skill.loadSkillInitLookup).toHaveBeenCalledOnce();
    expect(skill.loadSkillInitLookup).toHaveBeenCalledWith(skills);
    expect(skill.initSkillFromLookup).toHaveBeenCalledTimes(2);
    expect(skill.applySkill.init).not.toHaveBeenCalled();
    expect(skill.applySkill.getHash).toHaveBeenCalledWith(
      expect.objectContaining({ skill: skills[0] }),
      { init: 'batched' }
    );
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ skillDestinationSyncId: 'sync_1', contentVersion: 3 })
    );
  });

  it('fails with destination_too_large before hashing anything', async () => {
    mockSync('manifest');
    skill.getSkillInitLookupSize.mockReturnValue({
      files: maxSkillDestinationFiles,
      bytes: 0n
    });

    await run({ skillDestinationSyncId: 'sync_1' });

    expect(db.skillDestinationSync.updateMany).toHaveBeenCalledWith({
      where: { id: 'sync_1', status: 'processing' },
      data: { status: 'failed', completedAt: expect.any(Date) }
    });
    expect(log).toHaveBeenCalledWith(
      'sync_1',
      expect.stringContaining('destination_too_large')
    );
    expect(marketplace.init).not.toHaveBeenCalled();
    expect(skill.initSkillFromLookup).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('keeps the per-skill init and bucket check for code-bucket destinations', async () => {
    mockSync('code_bucket');
    available.mockResolvedValue(true);
    skill.applySkill.init.mockResolvedValue({ init: 'legacy' });

    await run({ skillDestinationSyncId: 'sync_1' });

    expect(available).toHaveBeenCalledOnce();
    expect(skill.loadSkillInitLookup).not.toHaveBeenCalled();
    expect(skill.applySkill.init).toHaveBeenCalledTimes(2);
  });
});
