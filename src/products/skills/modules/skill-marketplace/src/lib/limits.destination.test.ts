import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, refreshStoreByteSize, isFlagEnabledForInstance } = vi.hoisted(() => ({
  db: {
    skillMarketplace: { findUnique: vi.fn() },
    skillPlugin: { findUnique: vi.fn() },
    skillMarketplacePlugin: { findMany: vi.fn(), count: vi.fn() },
    skillPluginSkill: { findMany: vi.fn() },
    store: { findMany: vi.fn() },
    storeItem: { groupBy: vi.fn() }
  },
  refreshStoreByteSize: vi.fn(),
  isFlagEnabledForInstance: vi.fn()
}));

vi.mock('@metorial/db', () => ({ db }));
vi.mock('@metorial/fabric', () => ({ Fabric: { fire: vi.fn() } }));
vi.mock('@metorial/module-store', () => ({ refreshStoreByteSize }));
vi.mock('@metorial/module-flags', () => ({ flagService: { isFlagEnabledForInstance } }));

import {
  assertSkillMarketplaceDestinationSize,
  assertSkillMarketplaceLimits,
  assertSkillPluginDestinationSize,
  generatedFilesPerSkillMarketplace,
  generatedFilesPerSkillPlugin,
  getSkillMarketplaceContentSize,
  maxSkillDestinationBytes,
  SkillDestinationTooLargeError
} from './limits';

let ownerWith = (
  destination: { storageMode: string; storageModeChangedAt: Date | null } | null
) => ({ instanceOid: 1n, destination });

let manifest = { storageMode: 'manifest', storageModeChangedAt: null };
let codeBucket = { storageMode: 'code_bucket', storageModeChangedAt: null };
let demoted = { storageMode: 'code_bucket', storageModeChangedAt: new Date() };

let overCap = { skillMarketplaceOid: 5n, additionalBytes: maxSkillDestinationBytes };

describe('destination size at edit time', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.skillMarketplace.findUnique.mockResolvedValue(ownerWith(manifest));
    db.skillPlugin.findUnique.mockResolvedValue(ownerWith(manifest));
    isFlagEnabledForInstance.mockResolvedValue(false);
    db.skillMarketplacePlugin.findMany.mockResolvedValue([
      { skillPluginOid: 1n },
      { skillPluginOid: 2n }
    ]);
    db.skillMarketplacePlugin.count.mockResolvedValue(2);
    db.skillPluginSkill.findMany.mockResolvedValue([
      { skillPluginOid: 1n, skill: { storeOid: 10n } },
      { skillPluginOid: 2n, skill: { storeOid: 10n } },
      { skillPluginOid: 2n, skill: { storeOid: 11n } }
    ]);
    db.store.findMany.mockResolvedValue([
      { oid: 10n, byteSize: 100n },
      { oid: 11n, byteSize: null }
    ]);
    db.storeItem.groupBy.mockResolvedValue([
      { storeOid: 10n, _count: { _all: 3 } },
      { storeOid: 11n, _count: { _all: 1 } }
    ]);
    refreshStoreByteSize.mockResolvedValue(50n);
  });

  it('sums store content per occurrence plus the generated files', async () => {
    expect(await getSkillMarketplaceContentSize({ skillMarketplaceOid: 5n })).toEqual({
      files: 3 + 3 + 1 + 2 * generatedFilesPerSkillPlugin + generatedFilesPerSkillMarketplace,
      bytes: 250n
    });
    expect(db.skillPluginSkill.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          skillPluginOid: { in: [1n, 2n] },
          status: 'active',
          skill: { status: 'active' }
        })
      })
    );
    expect(refreshStoreByteSize).toHaveBeenCalledOnce();
  });

  it('rejects an addition that would push the marketplace over the cap', async () => {
    await expect(assertSkillMarketplaceDestinationSize(overCap)).rejects.toThrow(
      SkillDestinationTooLargeError
    );

    await expect(
      assertSkillMarketplaceDestinationSize({ skillMarketplaceOid: 5n, additionalFiles: 10 })
    ).resolves.toBeUndefined();
  });

  it('checks a code-bucket destination the migration will move to manifest storage', async () => {
    db.skillMarketplace.findUnique.mockResolvedValue(ownerWith(codeBucket));
    isFlagEnabledForInstance.mockResolvedValue(true);
    await expect(assertSkillMarketplaceDestinationSize(overCap)).rejects.toThrow(
      SkillDestinationTooLargeError
    );

    db.skillMarketplace.findUnique.mockResolvedValue(ownerWith(null));
    await expect(assertSkillMarketplaceDestinationSize(overCap)).rejects.toThrow(
      SkillDestinationTooLargeError
    );
  });

  it('skips code-bucket destinations that stay on code buckets', async () => {
    db.skillMarketplace.findUnique.mockResolvedValue(ownerWith(codeBucket));
    await expect(assertSkillMarketplaceDestinationSize(overCap)).resolves.toBeUndefined();

    isFlagEnabledForInstance.mockResolvedValue(true);
    db.skillMarketplace.findUnique.mockResolvedValue(ownerWith(demoted));
    await expect(assertSkillMarketplaceDestinationSize(overCap)).resolves.toBeUndefined();

    db.skillPlugin.findUnique.mockResolvedValue(ownerWith(demoted));
    await expect(
      assertSkillPluginDestinationSize({
        skillPluginOid: 1n,
        additionalBytes: maxSkillDestinationBytes
      })
    ).resolves.toBeUndefined();
    expect(db.skillPluginSkill.findMany).not.toHaveBeenCalled();
  });
});

describe('destination size at sync time', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isFlagEnabledForInstance.mockResolvedValue(true);
    db.skillMarketplacePlugin.count.mockResolvedValue(1);
    db.skillMarketplacePlugin.findMany.mockImplementation(async (args: any) =>
      args.select.skillPluginOid
        ? [{ skillPluginOid: 1n }]
        : [{ skillPlugin: { skillPluginSkills: [{ oid: 1n }] } }]
    );
    db.skillPluginSkill.findMany.mockResolvedValue([
      { skillPluginOid: 1n, skill: { storeOid: 10n } }
    ]);
    db.store.findMany.mockResolvedValue([
      { oid: 10n, byteSize: maxSkillDestinationBytes + 1n }
    ]);
    db.storeItem.groupBy.mockResolvedValue([{ storeOid: 10n, _count: { _all: 1 } }]);
  });

  it('lets an over-limit code-bucket marketplace sync, even when it would be migrated', async () => {
    db.skillMarketplace.findUnique.mockResolvedValue(ownerWith(codeBucket));

    await expect(assertSkillMarketplaceLimits({ skillMarketplaceOid: 5n })).resolves.toBe(
      undefined
    );
    expect(db.skillPluginSkill.findMany).not.toHaveBeenCalled();
  });

  it('fails an over-limit manifest marketplace', async () => {
    db.skillMarketplace.findUnique.mockResolvedValue(ownerWith(manifest));

    await expect(assertSkillMarketplaceLimits({ skillMarketplaceOid: 5n })).rejects.toThrow(
      SkillDestinationTooLargeError
    );
  });
});
