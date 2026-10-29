import type { Instance, Prisma, Project } from '@metorial/db';
import { badRequestError, ServiceError } from '@lowerdeck/error';
import {
  accessTagService,
  type ResourceAuthorization,
  consumerSkillWriteRoles,
  getStoreResourceKindAccessWhere,
  isStoreResourceFlagEnabled,
  skillStoreResourceKind
} from '@metorial/module-access';

export let assertSkillRecordScope = (d: {
  project: Project;
  instance: Instance;
  skill: {
    projectOid: bigint | null;
    instanceOid: bigint;
    store?: {
      projectOid: bigint | null;
      instanceOid: bigint | null;
    } | null;
  };
}) => {
  if (
    d.skill.projectOid != d.project.oid ||
    d.skill.instanceOid != d.instance.oid ||
    d.skill.store?.projectOid != d.project.oid ||
    d.skill.store?.instanceOid != d.instance.oid
  ) {
    throw new ServiceError(
      badRequestError({
        message: 'Skill does not belong to the supplied project and instance.'
      })
    );
  }
};

export let getSkillMetadataWriteAccessWhere = async (d: {
  project: Project;
  instance: Instance;
  skill: {
    oid: bigint;
  };
  authorization: ResourceAuthorization;
}): Promise<Prisma.SkillWhereInput | undefined> => {
  if (d.authorization.type == 'privileged') return undefined;

  if (await isStoreResourceFlagEnabled({ project: d.project, flag: 'store-access-v2' })) {
    let storeAccessWhere = await getStoreResourceKindAccessWhere({
      kind: skillStoreResourceKind,
      accessTags: d.authorization.accessTags,
      level: 'write'
    });

    return {
      oid: d.skill.oid,
      projectOid: d.project.oid,
      instanceOid: d.instance.oid,
      store: { is: storeAccessWhere }
    };
  }

  let accessTagFilter = await accessTagService.getAccessTagFilter({
    tags: d.authorization.accessTags,
    roles: [...consumerSkillWriteRoles]
  });
  return {
    oid: accessTagFilter ? d.skill.oid : { in: [] },
    projectOid: d.project.oid,
    instanceOid: d.instance.oid,
    accessTagEntities: accessTagFilter
  };
};
