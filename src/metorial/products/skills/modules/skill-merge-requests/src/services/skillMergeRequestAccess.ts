import type { ResourceAuthorization } from '@metorial/module-access';
import type { Prisma, StoreParticipantPermissions } from '@metorial/db';

let readableStorePermissions: StoreParticipantPermissions[] = [
  'content_read',
  'content_write'
];

export let getVisibleSkillMergeRequestWhere = (d: {
  projectOid: bigint;
  instanceOid: bigint;
  authorization: ResourceAuthorization;
}) => {
  let scopeWhere = {
    projectOid: d.projectOid,
    instanceOid: d.instanceOid
  } satisfies Prisma.SkillMergeRequestWhereInput;

  if (d.authorization.type === 'privileged') return scopeWhere;

  let actorOid = d.authorization.resourceActor.oid;
  let readableStoreWhere: Prisma.StoreWhereInput = {
    OR: [
      { access: { in: ['public_read', 'public_write'] } },
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
  } satisfies Prisma.SkillMergeRequestWhereInput;
};
