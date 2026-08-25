import { badRequestError, ServiceError } from '@lowerdeck/error';
import { db } from '@metorial/db';
import { refreshStoreByteSize } from '@metorial/module-store';

export let maxSkillStoreFiles = 1000;
export let maxSkillStoreBytes = 1024n * 1024n * 1024n;
export let maxSkillPluginSkills = 100;
export let maxSkillMarketplacePlugins = 500;
export let maxSkillMarketplaceSkills = 1000;

export class CargoSkillLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CargoSkillLimitError';
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

export let assertSkillStoreFileLimit = async (d: {
  storeOid: bigint;
  additionalCount?: number;
}) => {
  assertLimit({
    label: 'Skill store files',
    currentCount: await countSkillStoreFiles(d),
    additionalCount: d.additionalCount,
    max: maxSkillStoreFiles
  });
};

let formatBytes = (bytes: bigint) => {
  let mb = Number(bytes) / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)}GB` : `${mb.toFixed(2)}MB`;
};

/**
 * Caps the total size of a skill store. Everything downstream -- syncs, zip
 * exports, SCM exports -- streams rather than buffers, so this is a backstop
 * against runaway stores rather than a memory guard.
 */
export let assertSkillStoreByteLimit = async (d: {
  storeOid: bigint;
  additionalBytes?: bigint;
}) => {
  // Always recomputed: a document edit changes its file size without touching
  // any store item, so the cached value on the store can lag.
  let currentBytes = await refreshStoreByteSize({ storeOid: d.storeOid });
  let projectedBytes = currentBytes + (d.additionalBytes ?? 0n);

  if (projectedBytes <= maxSkillStoreBytes) return;

  throw new CargoSkillLimitError(
    `Skill store size cannot exceed ${formatBytes(maxSkillStoreBytes)}; ` +
      `this change would result in ${formatBytes(projectedBytes)}.`
  );
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
};
