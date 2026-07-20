import type { AnyAccessTagSelector } from '@metorial/module-access';
import {
  accessTagService,
  consumerSkillReadRoles,
  isCanonicalResourceAuthorizationEnabled,
  isLegacyResourceAuthorizationEnabled
} from '@metorial/module-access';
import type { Prisma } from '@metorial/db';

export type SkillMarketplaceAccessInput = {
  accessTags?: AnyAccessTagSelector;
  legacyConsumerGroupOids?: bigint[];
};

export let getSkillMarketplaceAccessWhere = async (
  d: SkillMarketplaceAccessInput
): Promise<Prisma.SkillMarketplaceWhereInput | undefined> => {
  if (!d.accessTags) return undefined;

  let accessTagEntities = isCanonicalResourceAuthorizationEnabled()
    ? await accessTagService.getAccessTagFilter({
        tags: d.accessTags,
        roles: [...consumerSkillReadRoles]
      })
    : undefined;
  let legacyConsumerGroupOids = d.legacyConsumerGroupOids ?? [];
  let accessPaths: Prisma.SkillMarketplaceWhereInput[] = accessTagEntities
    ? [{ accessTagEntities }]
    : [];
  if (isLegacyResourceAuthorizationEnabled() && legacyConsumerGroupOids.length) {
    accessPaths.push({
      consumerAccesses: {
        some: {
          type: 'skill_marketplace',
          consumerGroupOid: {
            in: legacyConsumerGroupOids
          }
        }
      }
    });
  }

  return accessPaths.length ? { OR: accessPaths } : { oid: { in: [] } };
};
