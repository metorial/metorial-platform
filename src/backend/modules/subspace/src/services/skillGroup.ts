import {
  ConsumerGroup,
  ConsumerProfile,
  db,
  ID,
  Instance,
  SkillGroup,
  withTransaction
} from '@metorial/db';
import { createSubspaceService } from '../lib/subspaceService';
import { getVisibleSkillWhere, intersectIds, subspaceSkillService } from './skill';
import { subspace } from '../subspace';

type SubspaceSkillGroupResult = Awaited<ReturnType<typeof subspace.skillGroup.get>>;
type SubspaceSkillGroupWithLocal = SubspaceSkillGroupResult & {
  localSkillGroup: SkillGroup;
};
type ConsumerReadContext = {
  consumerProfile?: ConsumerProfile;
  consumerGroups?: Pick<ConsumerGroup, 'oid'>[];
};

export let syncSkillGroupFromSubspace = async (d: {
  instance: Instance;
  skillGroup: SubspaceSkillGroupResult;
}) => {
  let [localGroup] = await syncSkillGroupsFromSubspace({
    instance: d.instance,
    skillGroups: [d.skillGroup]
  });

  return localGroup;
};

let localSkillGroupNeedsSync = (d: {
  skillGroup: SubspaceSkillGroupResult;
  localSkillGroup: SkillGroup | undefined;
}) => {
  if (!d.localSkillGroup) return true;

  if (d.localSkillGroup.status !== d.skillGroup.status) return true;
  if (d.localSkillGroup.name !== d.skillGroup.name) return true;
  if (d.localSkillGroup.description !== d.skillGroup.description) return true;
  if (d.localSkillGroup.updatedAt.getTime() !== d.skillGroup.updatedAt.getTime()) {
    return true;
  }

  return false;
};

export let syncSkillGroupsFromSubspace = async (d: {
  instance: Instance;
  skillGroups: SubspaceSkillGroupResult[];
}) => {
  if (!d.skillGroups.length) return [];

  let existing = await db.skillGroup.findMany({
    where: {
      id: {
        in: d.skillGroups.map(skillGroup => skillGroup.id)
      }
    }
  });
  let existingById = new Map(existing.map(skillGroup => [skillGroup.id, skillGroup]));
  let syncedGroups = await Promise.all(
    d.skillGroups
      .filter(skillGroup =>
        localSkillGroupNeedsSync({
          skillGroup,
          localSkillGroup: existingById.get(skillGroup.id)
        })
      )
      .map(skillGroup =>
        db.skillGroup.upsert({
          where: {
            id: skillGroup.id
          },
          create: {
            id: skillGroup.id,
            status: skillGroup.status,
            name: skillGroup.name,
            description: skillGroup.description,
            metadata: skillGroup.metadata,
            organizationOid: d.instance.organizationOid,
            instanceOid: d.instance.oid,
            createdAt: skillGroup.createdAt,
            updatedAt: skillGroup.updatedAt
          },
          update: {
            status: skillGroup.status,
            name: skillGroup.name,
            description: skillGroup.description,
            metadata: skillGroup.metadata,
            updatedAt: skillGroup.updatedAt
          }
        })
      )
  );
  let localGroupById = new Map([
    ...existing.map(skillGroup => [skillGroup.id, skillGroup] as const),
    ...syncedGroups.map(skillGroup => [skillGroup.id, skillGroup] as const)
  ]);
  let skillIds = [
    ...new Set(d.skillGroups.flatMap(skillGroup => skillGroup.skills.map(skill => skill.id)))
  ];
  let fullSkills = skillIds.length
    ? await subspaceSkillService.getMany({
        instance: d.instance,
        skillIds,
        allowDeleted: true
      })
    : [];
  let localSkillById = new Map(fullSkills.map(skill => [skill.id, skill.localSkill]));
  let localGroups = d.skillGroups.map(skillGroup => localGroupById.get(skillGroup.id)!);

  await withTransaction(async db => {
    let existingItems = await db.skillGroupItem.findMany({
      where: {
        skillGroupOid: {
          in: localGroups.map(skillGroup => skillGroup.oid)
        }
      }
    });
    let existingItemByKey = new Map(
      existingItems.map(item => [
        `${item.skillGroupOid.toString()}:${item.skillOid.toString()}`,
        item
      ])
    );

    for (let skillGroup of d.skillGroups) {
      let localGroup = localGroupById.get(skillGroup.id)!;
      let localSkills = skillGroup.skills
        .map(skill => localSkillById.get(skill.id))
        .filter((skill): skill is NonNullable<typeof skill> => !!skill);
      let localSkillOids = localSkills.map(localSkill => localSkill.oid);

      await db.skillGroupItem.updateMany({
        where: {
          skillGroupOid: localGroup.oid,
          status: 'active',
          skillOid: localSkillOids.length ? { notIn: localSkillOids } : undefined
        },
        data: {
          status: 'archived'
        }
      });

      for (let localSkill of localSkills) {
        let existingItem = existingItemByKey.get(
          `${localGroup.oid.toString()}:${localSkill.oid.toString()}`
        );
        if (existingItem?.status === 'active') continue;

        await db.skillGroupItem.upsert({
          where: {
            skillGroupOid_skillOid: {
              skillGroupOid: localGroup.oid,
              skillOid: localSkill.oid
            }
          },
          create: {
            id: await ID.generateId('skillGroupItem'),
            status: 'active',
            skillGroupOid: localGroup.oid,
            skillOid: localSkill.oid
          },
          update: {
            status: 'active'
          }
        });
      }
    }
  });

  return localGroups;
};

let enrichSkillGroup = async (d: {
  instance: Instance;
  skillGroup: SubspaceSkillGroupResult;
  consumerProfile?: ConsumerProfile;
  consumerGroups?: Pick<ConsumerGroup, 'oid'>[];
}): Promise<SubspaceSkillGroupWithLocal> => {
  let [skillGroup] = await enrichSkillGroupsFromList({
    instance: d.instance,
    skillGroups: [d.skillGroup],
    consumerProfile: d.consumerProfile,
    consumerGroups: d.consumerGroups
  });

  return skillGroup;
};

let enrichSkillGroupsFromList = async (d: {
  instance: Instance;
  skillGroups: SubspaceSkillGroupResult[];
  consumerProfile?: ConsumerProfile;
  consumerGroups?: Pick<ConsumerGroup, 'oid'>[];
}) => {
  if (!d.skillGroups.length) return [];

  let localSkillGroups = await syncSkillGroupsFromSubspace({
    instance: d.instance,
    skillGroups: d.skillGroups
  });
  let localGroupById = new Map(
    localSkillGroups.map(skillGroup => [skillGroup.id, skillGroup])
  );

  if (!d.consumerProfile) {
    return d.skillGroups.map(skillGroup => ({
      ...skillGroup,
      localSkillGroup: localGroupById.get(skillGroup.id)!
    }));
  }

  let directlyVisible = new Set(
    (
      await db.skillGroup.findMany({
        where: {
          oid: {
            in: localSkillGroups.map(skillGroup => skillGroup.oid)
          },
          consumerAccesses: {
            some: {
              consumerGroupOid: {
                in: d.consumerGroups?.map(group => group.oid) ?? []
              }
            }
          }
        },
        select: {
          oid: true
        }
      })
    ).map(skillGroup => skillGroup.oid.toString())
  );
  let visibleSkillIdsByGroupOid = new Map<string, Set<string>>();
  let visibleSkills = await db.skill.findMany({
    where: {
      skillGroupItems: {
        some: {
          skillGroupOid: {
            in: localSkillGroups.map(skillGroup => skillGroup.oid)
          },
          status: 'active'
        }
      },
      ...getVisibleSkillWhere({
        consumerProfile: d.consumerProfile,
        consumerGroups: d.consumerGroups ?? []
      })
    },
    select: {
      id: true,
      skillGroupItems: {
        where: {
          skillGroupOid: {
            in: localSkillGroups.map(skillGroup => skillGroup.oid)
          },
          status: 'active'
        },
        select: {
          skillGroupOid: true
        }
      }
    }
  });
  for (let skill of visibleSkills) {
    for (let item of skill.skillGroupItems) {
      let key = item.skillGroupOid.toString();
      let set = visibleSkillIdsByGroupOid.get(key);
      if (!set) {
        set = new Set();
        visibleSkillIdsByGroupOid.set(key, set);
      }
      set.add(skill.id);
    }
  }

  return d.skillGroups.map(skillGroup => {
    let localSkillGroup = localGroupById.get(skillGroup.id)!;
    if (directlyVisible.has(localSkillGroup.oid.toString())) {
      return {
        ...skillGroup,
        localSkillGroup
      };
    }

    let visibleSkillIds =
      visibleSkillIdsByGroupOid.get(localSkillGroup.oid.toString()) ?? new Set<string>();

    return {
      ...skillGroup,
      localSkillGroup,
      skills: skillGroup.skills.filter(skill => visibleSkillIds.has(skill.id))
    };
  });
};

let requireConsumerReadContext = (d: ConsumerReadContext) => {
  if (!d.consumerProfile) return null;
  return {
    consumerProfile: d.consumerProfile,
    consumerGroups: d.consumerGroups ?? []
  };
};

let getAccessibleSkillGroupIds = async (d: {
  instance: Instance;
  consumerProfile: ConsumerProfile;
  consumerGroups: Pick<ConsumerGroup, 'oid'>[];
  requestedIds?: string[];
}) => {
  let skillGroups = await db.skillGroup.findMany({
    where: {
      instanceOid: d.instance.oid,
      OR: [
        {
          consumerAccesses: {
            some: {
              consumerGroupOid: {
                in: d.consumerGroups.map(group => group.oid)
              }
            }
          }
        },
        {
          items: {
            some: {
              status: 'active' as const,
              skill: {
                is: getVisibleSkillWhere(d)
              }
            }
          }
        }
      ]
    },
    select: {
      id: true
    }
  });

  return intersectIds(
    skillGroups.map(skillGroup => skillGroup.id),
    d.requestedIds
  );
};

let assertSkillGroupReadable = async (d: {
  instance: Instance;
  skillGroupId: string;
  consumerProfile?: ConsumerProfile;
  consumerGroups?: Pick<ConsumerGroup, 'oid'>[];
}) => {
  if (!d.consumerProfile) return;

  let skillGroup = await db.skillGroup.findFirst({
    where: {
      instanceOid: d.instance.oid,
      id: d.skillGroupId,
      OR: [
        {
          consumerAccesses: {
            some: {
              consumerGroupOid: {
                in: d.consumerGroups?.map(group => group.oid) ?? []
              }
            }
          }
        },
        {
          items: {
            some: {
              status: 'active' as const,
              skill: {
                is: getVisibleSkillWhere({
                  consumerProfile: d.consumerProfile,
                  consumerGroups: d.consumerGroups ?? []
                })
              }
            }
          }
        }
      ]
    }
  });

  if (!skillGroup) throw new Error('Skill group not found');
};

export let subspaceSkillGroupService = createSubspaceService(
  subspace.skillGroup,
  ['get', 'list', 'create', 'update', 'delete'],
  inner => ({
    get: async (arg0: Parameters<typeof inner.get>[0] & ConsumerReadContext) => {
      await assertSkillGroupReadable({
        instance: arg0.instance,
        skillGroupId: arg0.skillGroupId,
        consumerProfile: arg0.consumerProfile,
        consumerGroups: arg0.consumerGroups
      });

      let { consumerProfile, consumerGroups, ...input } = arg0;
      let skillGroup = await inner.get(input);
      return await enrichSkillGroup({
        instance: arg0.instance,
        skillGroup,
        consumerProfile: arg0.consumerProfile,
        consumerGroups: arg0.consumerGroups
      });
    },
    list: async (arg0: Parameters<typeof inner.list>[0] & ConsumerReadContext) => {
      let readContext = requireConsumerReadContext(arg0);
      let ids = readContext
        ? await getAccessibleSkillGroupIds({
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
      return paginator.map(skillGroups =>
        enrichSkillGroupsFromList({
          instance: arg0.instance,
          skillGroups,
          consumerProfile: arg0.consumerProfile,
          consumerGroups: arg0.consumerGroups
        })
      );
    },
    create: async (...params: Parameters<typeof inner.create>) => {
      let skillGroup = await inner.create(...params);
      return await enrichSkillGroup({
        instance: params[0].instance,
        skillGroup
      });
    },
    update: async (...params: Parameters<typeof inner.update>) => {
      let skillGroup = await inner.update(...params);
      return await enrichSkillGroup({
        instance: params[0].instance,
        skillGroup
      });
    },
    delete: async (...params: Parameters<typeof inner.delete>) => {
      let skillGroup = await inner.delete(...params);
      return await enrichSkillGroup({
        instance: params[0].instance,
        skillGroup
      });
    }
  })
);

export type SubspaceSkillGroup = SubspaceSkillGroupWithLocal;
