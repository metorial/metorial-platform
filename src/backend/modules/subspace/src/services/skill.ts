import {
  Consumer,
  ConsumerGroup,
  ConsumerProfile,
  db,
  Instance,
  Skill,
  SkillStatus
} from '@metorial/db';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

type SubspaceSkillResult = Awaited<ReturnType<typeof subspace.skill.get>>;
type SubspaceSkillWithLocal = SubspaceSkillResult & {
  localSkill: Skill;
};
type ConsumerProfileForSkill = ConsumerProfile & {
  consumer: Consumer;
};
type ConsumerReadContext = {
  consumerProfile?: ConsumerProfile;
  consumerGroups?: Pick<ConsumerGroup, 'oid'>[];
};

let statusFromSubspace = (status: SubspaceSkillResult['status']): SkillStatus => status;
let skillEntityIdFromSubspace = (skill: SubspaceSkillResult) => skill.hierarchy.entity.id;

export let getVisibleSkillWhere = (d: {
  consumerProfile: ConsumerProfile;
  consumerGroups: Pick<ConsumerGroup, 'oid'>[];
}) => {
  let groupOids = d.consumerGroups.map(group => group.oid);

  return {
    OR: [
      {
        createdByConsumerProfileOid: d.consumerProfile.oid
      },
      {
        consumerAccesses: {
          some: {
            consumerGroupOid: {
              in: groupOids
            }
          }
        }
      },
      {
        skillGroupItems: {
          some: {
            status: 'active' as const,
            skillGroup: {
              consumerAccesses: {
                some: {
                  consumerGroupOid: {
                    in: groupOids
                  }
                }
              }
            }
          }
        }
      }
    ]
  };
};

export let intersectIds = (allowedIds: string[], requestedIds?: string[]) => {
  let uniqueAllowedIds = [...new Set(allowedIds)];
  if (!requestedIds?.length) return uniqueAllowedIds;

  let requestedIdSet = new Set(requestedIds);
  return uniqueAllowedIds.filter(id => requestedIdSet.has(id));
};

export let syncSkillFromSubspace = async (d: {
  instance: Instance;
  skill: SubspaceSkillResult;
  owner?: {
    consumerProfile?: ConsumerProfileForSkill;
  };
}) => {
  return await db.skill.upsert({
    where: {
      id: d.skill.id
    },
    create: {
      id: d.skill.id,
      status: statusFromSubspace(d.skill.status),
      name: d.skill.name,
      storeId: d.skill.storeId,
      skillEntityId: skillEntityIdFromSubspace(d.skill),
      ownerType: d.owner?.consumerProfile ? 'consumer' : 'instance',
      organizationOid: d.instance.organizationOid,
      instanceOid: d.instance.oid,
      createdByConsumerOid: d.owner?.consumerProfile?.consumerOid,
      createdByConsumerProfileOid: d.owner?.consumerProfile?.oid
    },
    update: {
      status: statusFromSubspace(d.skill.status),
      name: d.skill.name,
      storeId: d.skill.storeId,
      skillEntityId: skillEntityIdFromSubspace(d.skill),
      ownerType: d.owner?.consumerProfile ? 'consumer' : undefined,
      createdByConsumerOid: d.owner?.consumerProfile?.consumerOid,
      createdByConsumerProfileOid: d.owner?.consumerProfile?.oid,
      archivedAt: d.skill.status === 'archived' ? new Date() : undefined,
      deletedAt: d.skill.status === 'deleted' ? new Date() : undefined
    }
  });
};

let localSkillNeedsSync = (d: {
  skill: SubspaceSkillResult;
  localSkill: Skill | undefined;
  owner?: {
    consumerProfile?: ConsumerProfileForSkill;
  };
}) => {
  if (!d.localSkill) return true;

  if (d.localSkill.status !== statusFromSubspace(d.skill.status)) return true;
  if (d.localSkill.name !== d.skill.name) return true;
  if (d.localSkill.storeId !== d.skill.storeId) return true;
  if (d.localSkill.skillEntityId !== skillEntityIdFromSubspace(d.skill)) return true;
  if (d.skill.status === 'archived' && !d.localSkill.archivedAt) return true;
  if (d.skill.status === 'deleted' && !d.localSkill.deletedAt) return true;

  if (d.owner?.consumerProfile) {
    if (d.localSkill.ownerType !== 'consumer') return true;
    if (d.localSkill.createdByConsumerOid !== d.owner.consumerProfile.consumerOid) return true;
    if (d.localSkill.createdByConsumerProfileOid !== d.owner.consumerProfile.oid) {
      return true;
    }
  }

  return false;
};

let enrichSkillsFromList = async (d: {
  instance: Instance;
  skills: SubspaceSkillResult[];
  owner?: {
    consumerProfile?: ConsumerProfileForSkill;
  };
}) => {
  if (!d.skills.length) return [];

  let existing = await db.skill.findMany({
    where: {
      id: {
        in: d.skills.map(skill => skill.id)
      }
    }
  });
  let existingById = new Map(existing.map(skill => [skill.id, skill]));

  let synced = await Promise.all(
    d.skills
      .filter(skill =>
        localSkillNeedsSync({
          skill,
          localSkill: existingById.get(skill.id),
          owner: d.owner
        })
      )
      .map(skill =>
        syncSkillFromSubspace({
          instance: d.instance,
          skill,
          owner: d.owner
        })
      )
  );

  let localById = new Map([
    ...existing.map(skill => [skill.id, skill] as const),
    ...synced.map(skill => [skill.id, skill] as const)
  ]);

  return d.skills.map(skill => ({
    ...skill,
    localSkill: localById.get(skill.id)!
  }));
};

let enrichSkill = async (d: {
  instance: Instance;
  skill: SubspaceSkillResult;
  owner?: {
    consumerProfile?: ConsumerProfileForSkill;
  };
}): Promise<SubspaceSkillWithLocal> => {
  let [skill] = await enrichSkillsFromList({
    instance: d.instance,
    skills: [d.skill],
    owner: d.owner
  });

  return skill;
};

export let syncSkillsFromSubspace = async (d: {
  instance: Instance;
  skills: SubspaceSkillResult[];
  owner?: {
    consumerProfile?: ConsumerProfileForSkill;
  };
}) => {
  return (await enrichSkillsFromList(d)).map(skill => skill.localSkill);
};

let getAccessibleSkillIds = async (d: {
  instance: Instance;
  consumerProfile: ConsumerProfile;
  consumerGroups: Pick<ConsumerGroup, 'oid'>[];
  requestedIds?: string[];
}) => {
  let skills = await db.skill.findMany({
    where: {
      instanceOid: d.instance.oid,
      ...getVisibleSkillWhere(d)
    },
    select: {
      id: true
    }
  });

  return intersectIds(
    skills.map(skill => skill.id),
    d.requestedIds
  );
};

let assertSkillReadable = async (d: {
  instance: Instance;
  skillId: string;
  consumerProfile?: ConsumerProfile;
  consumerGroups?: Pick<ConsumerGroup, 'oid'>[];
}) => {
  if (!d.consumerProfile) return;

  let skill = await db.skill.findFirst({
    where: {
      instanceOid: d.instance.oid,
      id: d.skillId,
      ...getVisibleSkillWhere({
        consumerProfile: d.consumerProfile,
        consumerGroups: d.consumerGroups ?? []
      })
    }
  });

  if (!skill) throw new Error('Skill not found');
};

let requireConsumerReadContext = (d: ConsumerReadContext) => {
  if (!d.consumerProfile) return null;
  return {
    consumerProfile: d.consumerProfile,
    consumerGroups: d.consumerGroups ?? []
  };
};

export let subspaceSkillService = createSubspaceService(
  subspace.skill,
  ['get', 'list', 'create', 'update', 'delete', 'fork', 'duplicate', 'getMany', 'upsertActor'],
  inner => ({
    get: async (arg0: Parameters<typeof inner.get>[0] & ConsumerReadContext) => {
      await assertSkillReadable({
        instance: arg0.instance,
        skillId: arg0.skillId,
        consumerProfile: arg0.consumerProfile,
        consumerGroups: arg0.consumerGroups
      });

      let { consumerProfile, consumerGroups, ...input } = arg0;

      let skill = await inner.get(input);

      return await enrichSkill({
        instance: arg0.instance,
        skill
      });
    },
    getMany: async (...params: Parameters<typeof inner.getMany>) => {
      let skills = await inner.getMany(...params);

      return await enrichSkillsFromList({
        instance: params[0].instance,
        skills
      });
    },
    list: async (arg0: Parameters<typeof inner.list>[0] & ConsumerReadContext) => {
      let readContext = requireConsumerReadContext(arg0);
      let ids = readContext
        ? await getAccessibleSkillIds({
            instance: arg0.instance,
            consumerProfile: readContext.consumerProfile,
            consumerGroups: readContext.consumerGroups,
            requestedIds: arg0.ids
          })
        : arg0.ids;

      let { consumerProfile, consumerGroups, ...input } = arg0;

      let paginator = await inner.list({
        ...input,
        ids
      });

      return paginator.map(skills =>
        enrichSkillsFromList({
          instance: arg0.instance,
          skills
        })
      );
    },
    create: async (
      arg0: Parameters<typeof inner.create>[0] & {
        consumerProfile?: ConsumerProfileForSkill;
      }
    ) => {
      let { consumerProfile, ...input } = arg0;
      let skill = await inner.create(input);

      return await enrichSkill({
        instance: arg0.instance,
        skill,
        owner: consumerProfile ? { consumerProfile } : undefined
      });
    },
    update: async (...params: Parameters<typeof inner.update>) => {
      let skill = await inner.update(...params);

      return await enrichSkill({
        instance: params[0].instance,
        skill
      });
    },
    delete: async (...params: Parameters<typeof inner.delete>) => {
      let skill = await inner.delete(...params);
      return await enrichSkill({
        instance: params[0].instance,
        skill
      });
    },
    fork: async (
      arg0: Parameters<typeof inner.fork>[0] & {
        consumerProfile?: ConsumerProfileForSkill;
      }
    ) => {
      let { consumerProfile, ...input } = arg0;
      let skill = await inner.fork(input);

      return await enrichSkill({
        instance: arg0.instance,
        skill,
        owner: consumerProfile ? { consumerProfile } : undefined
      });
    },
    duplicate: async (...params: Parameters<typeof inner.duplicate>) => {
      let skill = await inner.duplicate(...params);

      return await enrichSkill({
        instance: params[0].instance,
        skill
      });
    }
  })
);

export type SubspaceSkill = SubspaceSkillWithLocal;
export type SubspaceProviderPreview = NonNullable<
  Awaited<ReturnType<typeof subspace.skillItem.get>>['provider']
>;
export type SubspaceIntegrationPreview = NonNullable<
  Awaited<ReturnType<typeof subspace.skillItem.get>>['integration']
>;
