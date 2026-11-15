import { badRequestError, ServiceError } from '@lowerdeck/error';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { refreshStoreByteSize } from '@metorial/module-store';
import { manifestFormatLimits } from './manifestFile/format';
import { getNewSkillDestinationStorageMode } from './storageMode';

export let maxSkillStoreFiles = 1000;
export let maxSkillStoreBytes = 1024n * 1024n * 1024n * 10n;
export let maxSkillPluginSkills = 100;
export let maxSkillMarketplacePlugins = 500;
export let maxSkillMarketplaceSkills = 1000;

export let maxSkillDestinationFiles = manifestFormatLimits.maxEntries;
export let maxSkillDestinationBytes = 1024n * 1024n * 1024n * 100n;
export let maxManifestFileBytes = manifestFormatLimits.maxFileBytes;

// Upper bounds for the files serializers generate besides skill store content (plugin and
// marketplace JSONs, MCP configs, logos, rendered agents), used for destination size estimates.
export let generatedFilesPerSkillPlugin = 32;
export let generatedFilesPerSkillMarketplace = 4;

let storeSizePageSize = 100;

export class CargoSkillLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CargoSkillLimitError';
  }
}

export class SkillDestinationTooLargeError extends CargoSkillLimitError {
  readonly code = 'destination_too_large';

  constructor(message: string) {
    super(message);
    this.name = 'SkillDestinationTooLargeError';
  }
}

export let toCargoSkillLimitServiceError = (error: CargoSkillLimitError) =>
  new ServiceError(badRequestError({ message: error.message }));

let assertLimit = (d: {
  label: string;
  currentCount: number;
  additionalCount?: number;
  max: number;
}) => {
  let projectedCount = d.currentCount + (d.additionalCount ?? 0);
  if (projectedCount <= d.max) return;

  throw new CargoSkillLimitError(
    `${d.label} cannot exceed ${d.max}; this change would result in ${projectedCount}.`
  );
};

export let countSkillStoreFiles = async (d: { storeOid: bigint }) =>
  await db.storeItem.count({
    where: {
      storeOid: d.storeOid,
      kind: { in: ['document', 'file'] }
    }
  });

export let checkSkillStoreFileCount = (d: {
  currentCount: number;
  additionalCount?: number;
}) =>
  assertLimit({
    label: 'Skill store files',
    currentCount: d.currentCount,
    additionalCount: d.additionalCount,
    max: maxSkillStoreFiles
  });

export let assertSkillStoreFileLimit = async (d: {
  storeOid: bigint;
  additionalCount?: number;
}) => {
  checkSkillStoreFileCount({
    currentCount: await countSkillStoreFiles(d),
    additionalCount: d.additionalCount
  });
};

let formatBytes = (bytes: bigint) => {
  let mb = Number(bytes) / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)}GB` : `${mb.toFixed(2)}MB`;
};

export let checkSkillStoreByteSize = async (d: {
  currentBytes: bigint;
  instanceOid: bigint;
  additionalBytes?: bigint;
}) => {
  let projectedBytes = d.currentBytes + (d.additionalBytes ?? 0n);

  await Fabric.fire('skill.store.size:before', {
    instance: { oid: d.instanceOid },
    storeSize: Number(projectedBytes)
  });

  if (projectedBytes <= maxSkillStoreBytes) return;

  throw new CargoSkillLimitError(
    `Skill store size cannot exceed ${formatBytes(maxSkillStoreBytes)}; ` +
      `this change would result in ${formatBytes(projectedBytes)}.`
  );
};

export let assertSkillStoreByteLimit = async (d: {
  storeOid: bigint;
  instanceOid: bigint;
  additionalBytes?: bigint;
}) => {
  await checkSkillStoreByteSize({
    currentBytes: await refreshStoreByteSize({ storeOid: d.storeOid }),
    instanceOid: d.instanceOid,
    additionalBytes: d.additionalBytes
  });
};

// Batched per-store file counts and byte sizes. Byte sizes come from the maintained
// `Store.byteSize`, computed once for stores that don't have it yet.
export let getSkillStoreSizes = async (storeOids: bigint[]) => {
  let sizes = new Map<bigint, { files: number; bytes: bigint }>();
  let uniqueOids = [...new Set(storeOids)];

  for (let i = 0; i < uniqueOids.length; i += storeSizePageSize) {
    let page = uniqueOids.slice(i, i + storeSizePageSize);

    let [stores, counts] = await Promise.all([
      db.store.findMany({
        where: { oid: { in: page } },
        select: { oid: true, byteSize: true }
      }),
      db.storeItem.groupBy({
        by: ['storeOid'],
        where: { storeOid: { in: page }, kind: { in: ['document', 'file'] } },
        _count: { _all: true }
      })
    ]);
    let countByStore = new Map(counts.map(count => [count.storeOid, count._count._all]));

    for (let store of stores) {
      sizes.set(store.oid, {
        files: countByStore.get(store.oid) ?? 0,
        bytes: store.byteSize ?? (await refreshStoreByteSize({ storeOid: store.oid }))
      });
    }
  }

  return sizes;
};

let formatSize = (d: { files: number; bytes: bigint }) =>
  `${d.files} files, ${formatBytes(d.bytes)}`;

export let checkSkillDestinationSize = (d: {
  label: string;
  files: number;
  bytes: bigint;
  additionalFiles?: number;
  additionalBytes?: bigint;
}) => {
  let projected = {
    files: d.files + (d.additionalFiles ?? 0),
    bytes: d.bytes + (d.additionalBytes ?? 0n)
  };
  if (
    projected.files <= maxSkillDestinationFiles &&
    projected.bytes <= maxSkillDestinationBytes
  )
    return;

  throw new SkillDestinationTooLargeError(
    `${d.label} cannot be synced with more than ${formatSize({
      files: maxSkillDestinationFiles,
      bytes: maxSkillDestinationBytes
    })}; this change would result in ${formatSize(projected)} (destination_too_large).`
  );
};

let activeSkillPluginSkillsWhere = {
  status: 'active',
  skill: { status: 'active' }
} as const;

export let getSkillPluginsContentSize = async (d: { skillPluginOids: bigint[] }) => {
  let pluginSkills = await db.skillPluginSkill.findMany({
    where: { skillPluginOid: { in: d.skillPluginOids }, ...activeSkillPluginSkillsWhere },
    select: { skillPluginOid: true, skill: { select: { storeOid: true } } }
  });
  let storeOids = pluginSkills.flatMap(pluginSkill =>
    pluginSkill.skill.storeOid ? [pluginSkill.skill.storeOid] : []
  );
  let storeSizes = await getSkillStoreSizes(storeOids);

  let files = d.skillPluginOids.length * generatedFilesPerSkillPlugin;
  let bytes = 0n;
  for (let storeOid of storeOids) {
    let size = storeSizes.get(storeOid);
    files += size?.files ?? 0;
    bytes += size?.bytes ?? 0n;
  }

  return { files, bytes };
};

export let getSkillMarketplaceContentSize = async (d: { skillMarketplaceOid: bigint }) => {
  let plugins = await db.skillMarketplacePlugin.findMany({
    where: {
      skillMarketplaceOid: d.skillMarketplaceOid,
      status: 'active',
      skillPlugin: { status: 'active' }
    },
    select: { skillPluginOid: true }
  });
  let size = await getSkillPluginsContentSize({
    skillPluginOids: plugins.map(plugin => plugin.skillPluginOid)
  });

  return { files: size.files + generatedFilesPerSkillMarketplace, bytes: size.bytes };
};

type DestinationSizeCheckPhase = 'edit' | 'sync';

let destinationOwnerSelect = {
  instanceOid: true,
  destination: { select: { storageMode: true, storageModeChangedAt: true } }
} as const;

// Only manifest destinations are capped. Edits are also checked for destinations that the
// migration cron will move to manifest storage, so they don't become unmigratable.
let destinationSizeLimitApplies = async (d: {
  owner: {
    instanceOid: bigint;
    destination: { storageMode: string; storageModeChangedAt: Date | null } | null;
  } | null;
  phase: DestinationSizeCheckPhase;
}) => {
  if (!d.owner) return false;

  let { destination } = d.owner;
  if (destination?.storageMode === 'manifest') return true;
  if (d.phase === 'sync' || destination?.storageModeChangedAt) return false;

  return (
    (await getNewSkillDestinationStorageMode({ instance: { oid: d.owner.instanceOid } })) ===
    'manifest'
  );
};

export let assertSkillMarketplaceDestinationSize = async (d: {
  skillMarketplaceOid: bigint;
  additionalFiles?: number;
  additionalBytes?: bigint;
  phase?: DestinationSizeCheckPhase;
}) => {
  let owner = await db.skillMarketplace.findUnique({
    where: { oid: d.skillMarketplaceOid },
    select: destinationOwnerSelect
  });
  if (!(await destinationSizeLimitApplies({ owner, phase: d.phase ?? 'edit' }))) return;

  checkSkillDestinationSize({
    label: 'A marketplace',
    ...(await getSkillMarketplaceContentSize(d)),
    additionalFiles: d.additionalFiles,
    additionalBytes: d.additionalBytes
  });
};

export let assertSkillPluginDestinationSize = async (d: {
  skillPluginOid: bigint;
  additionalFiles?: number;
  additionalBytes?: bigint;
}) => {
  let owner = await db.skillPlugin.findUnique({
    where: { oid: d.skillPluginOid },
    select: destinationOwnerSelect
  });
  if (!(await destinationSizeLimitApplies({ owner, phase: 'edit' }))) return;

  checkSkillDestinationSize({
    label: 'A plugin',
    ...(await getSkillPluginsContentSize({ skillPluginOids: [d.skillPluginOid] })),
    additionalFiles: d.additionalFiles,
    additionalBytes: d.additionalBytes
  });
};

export let countSkillPluginSkills = async (d: { skillPluginOid: bigint }) =>
  await db.skillPluginSkill.count({
    where: {
      skillPluginOid: d.skillPluginOid,
      status: 'active',
      skill: {
        status: 'active'
      }
    }
  });

export let assertSkillPluginSkillLimit = async (d: {
  skillPluginOid: bigint;
  additionalCount?: number;
}) => {
  assertLimit({
    label: 'Plugin skills',
    currentCount: await countSkillPluginSkills(d),
    additionalCount: d.additionalCount,
    max: maxSkillPluginSkills
  });
};

export let countSkillMarketplacePlugins = async (d: { skillMarketplaceOid: bigint }) =>
  await db.skillMarketplacePlugin.count({
    where: {
      skillMarketplaceOid: d.skillMarketplaceOid,
      status: 'active',
      skillPlugin: {
        status: 'active'
      }
    }
  });

export let assertSkillMarketplacePluginLimit = async (d: {
  skillMarketplaceOid: bigint;
  additionalCount?: number;
}) => {
  assertLimit({
    label: 'Marketplace plugins',
    currentCount: await countSkillMarketplacePlugins(d),
    additionalCount: d.additionalCount,
    max: maxSkillMarketplacePlugins
  });
};

export let countSkillMarketplaceSkills = async (d: { skillMarketplaceOid: bigint }) => {
  let plugins = await db.skillMarketplacePlugin.findMany({
    where: {
      skillMarketplaceOid: d.skillMarketplaceOid,
      status: 'active',
      skillPlugin: {
        status: 'active'
      }
    },
    select: {
      skillPlugin: {
        select: {
          skillPluginSkills: {
            where: {
              status: 'active',
              skill: {
                status: 'active'
              }
            },
            select: {
              oid: true
            }
          }
        }
      }
    }
  });

  return plugins.reduce(
    (count, plugin) => count + plugin.skillPlugin.skillPluginSkills.length,
    0
  );
};

export let assertSkillMarketplaceSkillLimit = async (d: {
  skillMarketplaceOid: bigint;
  additionalCount?: number;
}) => {
  assertLimit({
    label: 'Marketplace skills',
    currentCount: await countSkillMarketplaceSkills(d),
    additionalCount: d.additionalCount,
    max: maxSkillMarketplaceSkills
  });
};

export let assertSkillMarketplaceLimits = async (d: { skillMarketplaceOid: bigint }) => {
  await assertSkillMarketplacePluginLimit(d);
  await assertSkillMarketplaceSkillLimit(d);
  await assertSkillMarketplaceDestinationSize({ ...d, phase: 'sync' });
};

export let sumSkillStoreSizes = async (skills: { storeOid: bigint | null }[]) => {
  let storeOids = skills.flatMap(skill => (skill.storeOid ? [skill.storeOid] : []));
  let sizes = await getSkillStoreSizes(storeOids);

  let files = 0;
  let bytes = 0n;
  for (let storeOid of storeOids) {
    let size = sizes.get(storeOid);
    files += size?.files ?? 0;
    bytes += size?.bytes ?? 0n;
  }

  return { files, bytes };
};

export let assertSkillPluginCanAddSkills = async (d: {
  skillPluginOid: bigint;
  skills: { storeOid: bigint | null }[];
}) => {
  if (!d.skills.length) return;

  await assertSkillPluginSkillLimit({
    skillPluginOid: d.skillPluginOid,
    additionalCount: d.skills.length
  });

  let marketplacePlugins = await db.skillMarketplacePlugin.findMany({
    where: {
      skillPluginOid: d.skillPluginOid,
      status: 'active',
      skillMarketplace: { status: 'active' }
    },
    select: { skillMarketplaceOid: true }
  });
  for (let marketplacePlugin of marketplacePlugins) {
    await assertSkillMarketplaceSkillLimit({
      skillMarketplaceOid: marketplacePlugin.skillMarketplaceOid,
      additionalCount: d.skills.length
    });
  }

  let { files: additionalFiles, bytes: additionalBytes } = await sumSkillStoreSizes(d.skills);
  if (!additionalFiles && !additionalBytes) return;

  await assertSkillPluginDestinationSize({
    skillPluginOid: d.skillPluginOid,
    additionalFiles,
    additionalBytes
  });
  for (let marketplacePlugin of marketplacePlugins) {
    await assertSkillMarketplaceDestinationSize({
      skillMarketplaceOid: marketplacePlugin.skillMarketplaceOid,
      additionalFiles,
      additionalBytes
    });
  }
};
