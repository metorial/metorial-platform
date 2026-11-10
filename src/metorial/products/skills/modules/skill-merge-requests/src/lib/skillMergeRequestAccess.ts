import type { Prisma } from '@metorial/db';
import {
  getStoreResourceAccessWhere,
  type ResourceAuthorization
} from '@metorial/module-access';

export let getVisibleSkillMergeRequestWhere = async (d: {
  projectOid: bigint;
  instanceOid: bigint;
  authorization: ResourceAuthorization;
}): Promise<Prisma.SkillMergeRequestWhereInput> => {
  let scopeWhere = {
    projectOid: d.projectOid,
    instanceOid: d.instanceOid
  } satisfies Prisma.SkillMergeRequestWhereInput;

  if (d.authorization.type === 'privileged') return scopeWhere;

  let readableStoreWhere: Prisma.StoreWhereInput = {
    OR: [
      await getStoreResourceAccessWhere({
        accessTags: d.authorization.accessTags,
        level: 'read'
      }),
      { createdByResourceActorOid: d.authorization.resourceActor.oid }
    ]
  };

  return {
    ...scopeWhere,
    OR: [
      { sourceSkill: { store: readableStoreWhere } },
      { targetSkill: { store: readableStoreWhere } }
    ]
  };
};
