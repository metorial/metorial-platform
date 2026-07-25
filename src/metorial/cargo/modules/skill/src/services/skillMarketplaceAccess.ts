import type { AnyAccessTagSelector } from '@metorial/module-access';
import { accessTagService, consumerSkillReadRoles } from '@metorial/module-access';
import type { Prisma } from '@metorial/db';

export type SkillMarketplaceAccessInput = {
  accessTags?: AnyAccessTagSelector;
};

export let getSkillMarketplaceAccessWhere = async (
  d: SkillMarketplaceAccessInput
): Promise<Prisma.SkillMarketplaceWhereInput | undefined> => {
  if (!d.accessTags) return undefined;

  let accessTagEntities = await accessTagService.getAccessTagFilter({
    tags: d.accessTags,
    roles: [...consumerSkillReadRoles]
  });

  return accessTagEntities ? { accessTagEntities } : { oid: { in: [] } };
};
