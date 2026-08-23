import { forbiddenError, ServiceError } from '@lowerdeck/error';
import type { Prisma } from '@metorial/db';
import { db } from '@metorial/db';
import type { AnyAccessTagSelector } from '@metorial/module-access';
import {
  accessTagService,
  consumerSkillMarketplaceWriteRoles,
  consumerSkillPluginWriteRoles,
  consumerSkillReadRoles
} from '@metorial/module-access';
import { getConsumerSkillAccessWhere } from '@metorial/module-skill';

export type SkillMarketplaceAccessInput = {
  accessTags?: AnyAccessTagSelector;
};

export let getSkillMarketplaceAccessWhere = async (
  d: SkillMarketplaceAccessInput
): Promise<Prisma.SkillMarketplaceWhereInput | undefined> => {
  if (!d.accessTags) return undefined;

  let accessTagEntities = await accessTagService.getAccessTagFilter({
    tags: d.accessTags,
    roles: [...consumerSkillReadRoles, ...consumerSkillMarketplaceWriteRoles]
  });

  return accessTagEntities ? { accessTagEntities } : { oid: { in: [] } };
};

export let getSkillMarketplaceWriteAccessWhere = async (
  d: SkillMarketplaceAccessInput
): Promise<Prisma.SkillMarketplaceWhereInput | undefined> => {
  if (!d.accessTags) return undefined;

  let accessTagEntities = await accessTagService.getAccessTagFilter({
    tags: d.accessTags,
    roles: [...consumerSkillMarketplaceWriteRoles]
  });

  return accessTagEntities ? { accessTagEntities } : { oid: { in: [] } };
};

export let getSkillPluginWriteAccessWhere = async (
  d: SkillMarketplaceAccessInput
): Promise<Prisma.SkillPluginWhereInput | undefined> => {
  if (!d.accessTags) return undefined;

  let pluginWriteEntities = await accessTagService.getAccessTagFilter({
    tags: d.accessTags,
    roles: [...consumerSkillPluginWriteRoles]
  });
  let marketplaceWriteWhere = await getSkillMarketplaceWriteAccessWhere(d);

  return {
    OR: [
      pluginWriteEntities ? { accessTagEntities: pluginWriteEntities } : undefined!,
      marketplaceWriteWhere
        ? {
            skillMarketplacePlugins: {
              some: {
                status: 'active',
                skillMarketplace: {
                  status: 'active',
                  AND: [marketplaceWriteWhere]
                }
              }
            }
          }
        : undefined!
    ].filter(Boolean) as Prisma.SkillPluginWhereInput[]
  };
};

export let hasSkillMarketplaceWriteAccess = async (d: {
  skillMarketplace: { oid: bigint };
  accessTags?: AnyAccessTagSelector;
}) => {
  if (!d.accessTags) return true;

  let accessWhere = await getSkillMarketplaceWriteAccessWhere(d);
  if (!accessWhere) return false;

  let marketplace = await db.skillMarketplace.findFirst({
    where: {
      oid: d.skillMarketplace.oid,
      AND: [accessWhere]
    },
    select: {
      oid: true
    }
  });

  return !!marketplace;
};

export let hasSkillPluginWriteAccess = async (d: {
  skillPlugin: { oid: bigint };
  accessTags?: AnyAccessTagSelector;
}) => {
  if (!d.accessTags) return true;

  let accessWhere = await getSkillPluginWriteAccessWhere(d);
  if (!accessWhere) return false;

  let skillPlugin = await db.skillPlugin.findFirst({
    where: {
      oid: d.skillPlugin.oid,
      AND: [accessWhere]
    },
    select: {
      oid: true
    }
  });

  return !!skillPlugin;
};

export let hasSkillPluginArchiveAccess = async (d: {
  skillPlugin: { oid: bigint };
  accessTags?: AnyAccessTagSelector;
}) => {
  if (!d.accessTags) return true;

  let archivableIds = await getArchivableSkillPluginIds({
    plugins: [{ oid: d.skillPlugin.oid, id: 'plugin' }],
    accessTags: d.accessTags
  });

  return archivableIds.has('plugin');
};

export let getWritableSkillPluginIds = async (d: {
  plugins: { oid: bigint; id: string }[];
  accessTags?: AnyAccessTagSelector;
}) => {
  if (!d.accessTags) return new Set(d.plugins.map(plugin => plugin.id));
  if (!d.plugins.length) return new Set<string>();

  let accessWhere = await getSkillPluginWriteAccessWhere(d);
  if (!accessWhere) return new Set<string>();

  let writable = await db.skillPlugin.findMany({
    where: {
      oid: { in: d.plugins.map(plugin => plugin.oid) },
      AND: [accessWhere]
    },
    select: { id: true }
  });

  return new Set(writable.map(plugin => plugin.id));
};

export let getArchivableSkillPluginIds = async (d: {
  plugins: { oid: bigint; id: string }[];
  accessTags?: AnyAccessTagSelector;
}) => {
  if (!d.accessTags) return new Set(d.plugins.map(plugin => plugin.id));
  if (!d.plugins.length) return new Set<string>();

  let marketplaceWriteWhere = await getSkillMarketplaceWriteAccessWhere(d);
  if (!marketplaceWriteWhere) return new Set<string>();

  let memberships = await db.skillMarketplacePlugin.findMany({
    where: {
      skillPluginOid: { in: d.plugins.map(plugin => plugin.oid) },
      status: 'active',
      skillMarketplace: {
        status: 'active'
      }
    },
    select: {
      skillPluginOid: true,
      skillMarketplaceOid: true
    }
  });

  let marketplaceOids = [
    ...new Set(memberships.map(membership => membership.skillMarketplaceOid))
  ];
  let writableMarketplaces = marketplaceOids.length
    ? await db.skillMarketplace.findMany({
        where: {
          oid: { in: marketplaceOids },
          AND: [marketplaceWriteWhere]
        },
        select: { oid: true }
      })
    : [];
  let writableMarketplaceOids = new Set(
    writableMarketplaces.map(marketplace => marketplace.oid)
  );

  let membershipsByPlugin = new Map<bigint, bigint[]>();
  for (let membership of memberships) {
    let current = membershipsByPlugin.get(membership.skillPluginOid) ?? [];
    current.push(membership.skillMarketplaceOid);
    membershipsByPlugin.set(membership.skillPluginOid, current);
  }

  let archivable = new Set<string>();
  for (let plugin of d.plugins) {
    let pluginMemberships = membershipsByPlugin.get(plugin.oid) ?? [];
    if (!pluginMemberships.length) continue;
    if (pluginMemberships.every(oid => writableMarketplaceOids.has(oid))) {
      archivable.add(plugin.id);
    }
  }

  return archivable;
};

export let assertSkillMarketplaceWriteAccess = async (d: {
  skillMarketplace: { oid: bigint };
  accessTags?: AnyAccessTagSelector;
}) => {
  if (await hasSkillMarketplaceWriteAccess(d)) return;

  throw new ServiceError(
    forbiddenError({
      message: 'You do not have permission to manage this skill marketplace.'
    })
  );
};

export let assertSkillPluginWriteAccess = async (d: {
  skillPlugin: { oid: bigint };
  accessTags?: AnyAccessTagSelector;
}) => {
  if (await hasSkillPluginWriteAccess(d)) return;

  throw new ServiceError(
    forbiddenError({
      message: 'You do not have permission to manage this skill plugin.'
    })
  );
};

export let assertSkillPluginArchiveAccess = async (d: {
  skillPlugin: { oid: bigint };
  accessTags?: AnyAccessTagSelector;
}) => {
  if (await hasSkillPluginArchiveAccess(d)) return;

  throw new ServiceError(
    forbiddenError({
      message:
        'You do not have permission to archive this skill plugin. Unlink it from marketplaces you manage instead.'
    })
  );
};

export let assertConsumerCanAttachSkillToPlugin = async (d: {
  skill: { oid: bigint };
  skillPlugin: { oid: bigint };
  accessTags: AnyAccessTagSelector;
}) => {
  let skillAccessWhere = await getConsumerSkillAccessWhere(d);
  if (skillAccessWhere) {
    let readableSkill = await db.skill.findFirst({
      where: {
        oid: d.skill.oid,
        AND: [skillAccessWhere]
      },
      select: { oid: true }
    });
    if (readableSkill) return;
  }

  let marketplaceAccessWhere = await getSkillMarketplaceAccessWhere(d);
  if (marketplaceAccessWhere) {
    let catalogSkill = await db.skillPluginSkill.findFirst({
      where: {
        skillOid: d.skill.oid,
        status: 'active',
        skillPlugin: {
          skillMarketplacePlugins: {
            some: {
              status: 'active',
              skillMarketplace: {
                status: 'active',
                AND: [marketplaceAccessWhere],
                plugins: {
                  some: {
                    status: 'active',
                    skillPluginOid: d.skillPlugin.oid
                  }
                }
              }
            }
          }
        }
      },
      select: { oid: true }
    });
    if (catalogSkill) return;
  }

  throw new ServiceError(
    forbiddenError({
      message:
        'You can only add skills that are already in this marketplace catalog or that you can read.'
    })
  );
};
