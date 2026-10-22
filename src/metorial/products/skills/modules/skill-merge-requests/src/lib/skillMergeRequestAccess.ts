import type { Prisma, StoreParticipantPermissions } from '@metorial/db';
import {
  accessTagService,
  consumerSkillReadRoles,
  type ResourceAuthorization
} from '@metorial/module-access';

let readableStorePermissions: StoreParticipantPermissions[] = [
  'content_read',
  'content_write'
];

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

  let actorOid = d.authorization.resourceActor.oid;
  let accessTagFilter = await accessTagService.getAccessTagFilter({
    tags: d.authorization.accessTags,
    roles: [...consumerSkillReadRoles]
  });

  // Skill stores ignore their public access setting; consumers read them through access tags
  // on the skill or an active skill group containing it, same as the store access check.
  let readableSkillWhere: Prisma.StoreWhereInput | undefined = accessTagFilter
    ? {
        skill: {
          is: {
            status: 'active',
            OR: [
              { accessTagEntities: accessTagFilter },
              {
                skillGroupItems: {
                  some: {
                    status: 'active',
                    skillGroup: {
                      status: 'active',
                      accessTagEntities: accessTagFilter
                    }
                  }
                }
              }
            ]
          }
        }
      }
    : undefined;

  let readableStoreWhere: Prisma.StoreWhereInput = {
    OR: [
      { access: { in: ['public_read', 'public_write'] }, skill: { is: null } },
      ...(readableSkillWhere ? [readableSkillWhere] : []),
      { createdByResourceActorOid: actorOid },
      {
        storeParticipants: {
          some: {
            resourceActorOid: actorOid,
            permissions: {
              hasSome: readableStorePermissions
            }
          }
        }
      }
    ]
  };

  return {
    ...scopeWhere,
    OR: [
      {
        sourceSkill: {
          store: readableStoreWhere
        }
      },
      {
        targetSkill: {
          store: readableStoreWhere
        }
      }
    ]
  };
};
