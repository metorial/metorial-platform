import type { Prisma } from '@metorial/db';
import { badRequestError, ServiceError } from '@lowerdeck/error';
import {
  accessTagService,
  type ResourceAuthorization,
  consumerSkillWriteRoles
} from '@metorial/module-access';
import type { ResourceScope } from '@metorial/module-resource-tenant';

export let assertSkillRecordScope = (
  d: ResourceScope & {
    skill: {
      resourceTenantOid: bigint | null;
      resourceGroupOid: bigint | null;
      store?: {
        resourceTenantOid: bigint;
        resourceGroupOid: bigint;
      } | null;
    };
  }
) => {
  if (
    d.skill.resourceTenantOid != d.resourceTenant.oid ||
    d.skill.resourceGroupOid != d.resourceGroup.oid ||
    d.skill.store?.resourceTenantOid != d.resourceTenant.oid ||
    d.skill.store?.resourceGroupOid != d.resourceGroup.oid
  ) {
    throw new ServiceError(
      badRequestError({
        message: 'Skill does not belong to the supplied ResourceScope.'
      })
    );
  }
};

export let getSkillMetadataWriteAccessWhere = async (
  d: ResourceScope & {
    skill: {
      oid: bigint;
    };
    authorization: ResourceAuthorization;
  }
): Promise<Prisma.SkillWhereInput | undefined> => {
  if (d.authorization.type == 'privileged') return undefined;

  let accessTagFilter = await accessTagService.getAccessTagFilter({
    tags: d.authorization.accessTags,
    roles: [...consumerSkillWriteRoles]
  });
  return {
    oid: accessTagFilter ? d.skill.oid : { in: [] },
    resourceTenantOid: d.resourceTenant.oid,
    resourceGroupOid: d.resourceGroup.oid,
    accessTagEntities: accessTagFilter
  };
};
