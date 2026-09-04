import { badRequestError, ServiceError } from '@lowerdeck/error';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { refreshStoreByteSize } from '@metorial/module-store';

export let maxSkillStoreFiles = 1000;
export let maxSkillStoreBytes = 1024n * 1024n * 1024n * 10n;
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

export let assertSkillStoreByteLimit = async (d: {
  storeOid: bigint;
  instanceOid: bigint;
  additionalBytes?: bigint;
}) => {
  let currentBytes = await refreshStoreByteSize({ storeOid: d.storeOid });
  let projectedBytes = currentBytes + (d.additionalBytes ?? 0n);

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
