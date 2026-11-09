import { beforeEach, describe, expect, it, vi } from 'vitest';

let { data, db, fire, refreshStoreByteSize } = vi.hoisted(() => {
  let data = {
    stores: [] as any[],
    storeItems: [] as { storeOid: bigint }[],
    configs: [] as any[]
  };

  let db = {
    store: {
      findFirstOrThrow: vi.fn(async ({ where }: any) => {
        let store = data.stores.find(store => store.oid === where.oid);
        if (!store) throw new Error('not found');
        return store;
      }),
      findMany: vi.fn(async ({ where }: any) =>
        data.stores.filter(store => where.oid.in.includes(store.oid))
      )
    },
    storeItem: {
      count: vi.fn(
        async ({ where }: any) =>
          data.storeItems.filter(item => item.storeOid === where.storeOid).length
      ),
      groupBy: vi.fn(async ({ where }: any) => {
        let counts = new Map<bigint, number>();
        for (let item of data.storeItems) {
          if (!where.storeOid.in.includes(item.storeOid)) continue;
          counts.set(item.storeOid, (counts.get(item.storeOid) ?? 0) + 1);
        }
        return [...counts].map(([storeOid, count]) => ({ storeOid, _count: { _all: count } }));
      })
    },
    skillConfiguration: {
      findFirst: vi.fn(
        async ({ where }: any) =>
          data.configs.find(
            config =>
              config.isDefault &&
              config.projectOid === where.projectOid &&
              config.instanceOid === where.instanceOid
          ) ?? null
      ),
      findMany: vi.fn(async ({ where }: any) =>
        data.configs
          .filter(
            config =>
              config.isDefault &&
              where.OR.some(
                (scope: any) =>
                  scope.projectOid === config.projectOid &&
                  scope.instanceOid === config.instanceOid
              )
          )
          .sort((a, b) => Number(a.oid - b.oid))
      )
    }
  };

  return {
    data,
    db,
    fire: vi.fn(),
    refreshStoreByteSize: vi.fn(async ({ storeOid }: { storeOid: bigint }) => {
      return data.stores.find(store => store.oid === storeOid)!.byteSize ?? 0n;
    })
  };
});

vi.mock('@metorial/db', () => ({ db }));
vi.mock('@metorial/fabric', () => ({ Fabric: { fire } }));
vi.mock('@metorial/module-store', () => ({ refreshStoreByteSize }));
vi.mock('@metorial/module-file', () => ({ fileService: {} }));
vi.mock('@metorial/module-flags', () => ({ flagService: {} }));

import {
  CargoSkillLimitError,
  checkSkillDestinationSize,
  maxSkillDestinationBytes,
  maxSkillDestinationFiles,
  SkillDestinationTooLargeError
} from '../../lib/limits';
import {
  applySkill,
  getSkillInitLookupSize,
  initSkillFromLookup,
  loadSkillInitLookup
} from './index';

let config = (oid: bigint, overrides: Record<string, unknown> = {}) => ({
  oid,
  isDefault: false,
  projectOid: 1n,
  instanceOid: 1n,
  allowScripts: true,
  allowedFileExtensions: [],
  allowNonStandardDirectories: true,
  ...overrides
});

let skill = (id: string, storeOid: bigint, overrides: Record<string, unknown> = {}) => ({
  id,
  storeOid,
  projectOid: 1n,
  instanceOid: 1n,
  name: `Skill ${id}`,
  clientName: null,
  description: 'desc',
  clientDescription: null,
  license: null,
  compatibility: null,
  clientMetadata: null,
  ...overrides
});

let input = (d: {
  skill: ReturnType<typeof skill>;
  slug: string;
  pluginConfig?: unknown;
  marketplace?: unknown;
}) =>
  ({
    skill: d.skill,
    skillPlugin: { skillConfiguration: d.pluginConfig ?? null },
    skillPluginSkill: { pluginSkillSlug: d.slug, skillConfiguration: null },
    ...(d.marketplace
      ? {
          skillMarketplace: d.marketplace,
          skillMarketplacePlugin: { pluginSlug: 'plugin', skillConfiguration: null }
        }
      : {})
  }) as any;

let unbatchedHash = async (value: any) =>
  await applySkill.getHash(value, await applySkill.init(value));

describe('batched skill init lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    data.stores = [
      { oid: 10n, instanceOid: 1n, byteSize: 300n, lastEditedAt: new Date(1) },
      { oid: 11n, instanceOid: 1n, byteSize: null, lastEditedAt: new Date(2) },
      { oid: 12n, instanceOid: 2n, byteSize: 5n, lastEditedAt: new Date(3) }
    ];
    data.storeItems = [{ storeOid: 10n }, { storeOid: 10n }, { storeOid: 11n }];
    data.configs = [
      config(1n, { isDefault: true, allowScripts: false }),
      config(2n, { isDefault: true, allowScripts: true }),
      config(3n, {
        isDefault: true,
        projectOid: 2n,
        instanceOid: 2n,
        allowedFileExtensions: ['md']
      })
    ];
  });

  it('hashes every skill exactly like the per-skill init', async () => {
    let inputs = [
      input({ skill: skill('a', 10n), slug: 'a' }),
      input({
        skill: skill('a', 10n),
        slug: 'a-again',
        pluginConfig: config(9n, { allowScripts: false })
      }),
      input({ skill: skill('b', 11n), slug: 'b', marketplace: { forceSyncCounter: 2 } }),
      input({ skill: skill('c', 12n, { projectOid: 2n, instanceOid: 2n }), slug: 'c' })
    ];

    let lookup = await loadSkillInitLookup(inputs.map(value => value.skill));

    for (let value of inputs) {
      let batched = await applySkill.getHash(value, await initSkillFromLookup(value, lookup));
      expect(batched).toBe(await unbatchedHash(value));
    }
  });

  it('issues a fixed number of queries regardless of how many skills share them', async () => {
    let skills = Array.from({ length: 50 }, (_, i) => skill(`s${i}`, i % 2 ? 10n : 11n));

    await loadSkillInitLookup(skills);

    expect(db.store.findMany).toHaveBeenCalledTimes(2);
    expect(db.storeItem.groupBy).toHaveBeenCalledOnce();
    expect(db.skillConfiguration.findMany).toHaveBeenCalledOnce();
    expect(db.store.findFirstOrThrow).not.toHaveBeenCalled();
    expect(refreshStoreByteSize).toHaveBeenCalledOnce();
    expect(refreshStoreByteSize).toHaveBeenCalledWith({ storeOid: 11n });
  });

  it('applies the store limits and fires the size hook like the per-skill init', async () => {
    let value = input({ skill: skill('a', 10n), slug: 'a' });
    let lookup = await loadSkillInitLookup([value.skill]);

    await initSkillFromLookup(value, lookup);

    expect(fire).toHaveBeenCalledWith('skill.store.size:before', {
      instance: { oid: 1n },
      storeSize: 300
    });

    data.storeItems = Array.from({ length: 1001 }, () => ({ storeOid: 10n }));
    let fullLookup = await loadSkillInitLookup([value.skill]);

    await expect(initSkillFromLookup(value, fullLookup)).rejects.toThrow(CargoSkillLimitError);
    await expect(applySkill.init(value)).rejects.toThrow(CargoSkillLimitError);
  });

  it('counts store content once per occurrence for the destination size', async () => {
    let lookup = await loadSkillInitLookup([skill('a', 10n), skill('b', 11n)]);

    expect(
      getSkillInitLookupSize(lookup, [skill('a', 10n), skill('a', 10n), skill('b', 11n)])
    ).toEqual({ files: 5, bytes: 600n + 0n });
  });

  it('fails for a skill whose store is gone', async () => {
    let lookup = await loadSkillInitLookup([]);

    await expect(
      initSkillFromLookup(input({ skill: skill('x', 99n), slug: 'x' }), lookup)
    ).rejects.toThrow('Store 99');
  });
});

describe('destination size cap', () => {
  it('allows content up to the caps', () => {
    expect(() =>
      checkSkillDestinationSize({
        label: 'A marketplace',
        files: maxSkillDestinationFiles,
        bytes: maxSkillDestinationBytes
      })
    ).not.toThrow();
  });

  it.each([
    ['too many files', { files: maxSkillDestinationFiles + 1, bytes: 0n }],
    ['too many bytes', { files: 1, bytes: maxSkillDestinationBytes + 1n }],
    [
      'an addition over the cap',
      { files: maxSkillDestinationFiles, bytes: 0n, additionalFiles: 1 }
    ]
  ])('rejects %s with destination_too_large', (_, size) => {
    let error = (() => {
      try {
        checkSkillDestinationSize({ label: 'A marketplace', ...size });
      } catch (error) {
        return error;
      }
    })();

    expect(error).toBeInstanceOf(SkillDestinationTooLargeError);
    expect(error).toBeInstanceOf(CargoSkillLimitError);
    expect((error as SkillDestinationTooLargeError).code).toBe('destination_too_large');
    expect((error as Error).message).toContain('destination_too_large');
  });
});
