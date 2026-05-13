import {
  forbiddenError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  Consumer,
  ConsumerGroup,
  ConsumerProfile,
  ConsumerSkillPermission,
  ConsumerSurface,
  db,
  ID,
  Instance,
  Organization,
  Prisma,
  Skill,
  SkillStatus,
  withTransaction
} from '@metorial/db';
import { subspaceSkillService, subspaceSkillTemplateService } from '@metorial/module-subspace';
import { consumerAccessPolicyService } from './accessPolicy';
import { consumerAccessService } from './consumerAccess';

let consumerSkillInclude = {
  skill: true
} as const;

export type ConsumerProfileForSkill = ConsumerProfile & {
  consumer: Consumer;
};

export type ConsumerSkillVisibilityInput = {
  consumerProfile: ConsumerProfile;
  consumerGroups: Pick<ConsumerGroup, 'oid'>[];
};

type ConsumerSkillCreateInput = {
  name: string;
  description?: string;
  clientName?: string;
  clientDescription?: string;
  license?: string;
  compatibility?: string;
  clientMetadata?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  privateMetadata?: Record<string, unknown>;
  templateId?: string;
};

type ConsumerSkillForkInput = ConsumerSkillCreateInput & {
  allowDeleted?: boolean;
};

type ConsumerSkillUpdateInput = {
  name?: string;
  description?: string | null;
  clientName?: string;
  clientDescription?: string;
  license?: string | null;
  compatibility?: string | null;
  clientMetadata?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  privateMetadata?: Record<string, unknown> | null;
};

export type SubspaceSkillListInput = Parameters<typeof subspaceSkillService.list>[0];

export let uniquePermissions = (permissions: ConsumerSkillPermission[]) => [
  ...new Set(permissions)
];
export let intersectIds = (allowedIds: string[], requestedIds?: string[]) => {
  let uniqueAllowedIds = [...new Set(allowedIds)];
  if (!requestedIds?.length) return uniqueAllowedIds;

  let requestedIdSet = new Set(requestedIds);
  return uniqueAllowedIds.filter(id => requestedIdSet.has(id));
};
export let toSubspacePaginationQuery = (opts: { take?: number; cursor?: { id: string } }) => ({
  limit: opts.take,
  cursor: opts.cursor?.id
});

export let getVisibleSkillWhere = (
  d: ConsumerSkillVisibilityInput
): Prisma.SkillWhereInput => {
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

class ConsumerSkillServiceImpl {
  private async assertConsumerCanReadSkill(d: {
    skill: Skill;
    consumerProfile: ConsumerProfile;
    consumerGroups: Pick<ConsumerGroup, 'oid'>[];
  }) {
    let localSkill = await db.skill.findFirst({
      where: {
        oid: d.skill.oid,
        ...getVisibleSkillWhere(d)
      }
    });

    if (!localSkill) {
      throw new ServiceError(notFoundError('skill', d.skill.id));
    }
  }

  private async assertConsumerCanWriteSkill(d: {
    skill: Skill;
    consumerProfile: ConsumerProfile;
  }) {
    if (d.skill.createdByConsumerProfileOid === d.consumerProfile.oid) {
      return;
    }

    let consumerSkill = await db.consumerSkill.findFirst({
      where: {
        skillOid: d.skill.oid,
        consumerProfileOid: d.consumerProfile.oid,
        permissions: {
          has: 'write'
        }
      }
    });

    if (!consumerSkill) {
      throw new ServiceError(
        forbiddenError({
          message: 'Consumer does not have write access to this skill.'
        })
      );
    }
  }

  async ensureConsumerSkill(d: {
    organization: Organization;
    instance: Instance;
    consumerSurface: ConsumerSurface;
    consumerProfile: ConsumerProfileForSkill;
    skill: Skill;
    permissions: ConsumerSkillPermission[];
  }) {
    let permissions = uniquePermissions(d.permissions);
    let existing = await db.consumerSkill.findUnique({
      where: {
        consumerProfileOid_skillOid: {
          consumerProfileOid: d.consumerProfile.oid,
          skillOid: d.skill.oid
        }
      }
    });
    let nextPermissions = uniquePermissions([
      ...(existing?.permissions ?? []),
      ...permissions
    ]);
    let upsertedActor = nextPermissions.includes('write')
      ? await subspaceSkillService.upsertActor({
          instance: d.instance,
          skillId: d.skill.id,
          consumer: d.consumerProfile.consumer,
          permissions: ['content_read', 'content_write']
        })
      : null;

    return await withTransaction(async db => {
      return await db.consumerSkill.upsert({
        where: {
          consumerProfileOid_skillOid: {
            consumerProfileOid: d.consumerProfile.oid,
            skillOid: d.skill.oid
          }
        },
        create: {
          id: await ID.generateId('consumerSkill'),
          source:
            d.skill.createdByConsumerProfileOid === d.consumerProfile.oid ? 'owner' : 'access',
          permissions: nextPermissions,
          organizationOid: d.organization.oid,
          instanceOid: d.instance.oid,
          surfaceOid: d.consumerSurface.oid,
          consumerProfileOid: d.consumerProfile.oid,
          consumerOid: d.consumerProfile.consumerOid,
          skillOid: d.skill.oid,
          cargoStoreParticipantId: upsertedActor?.storeParticipantId ?? null
        },
        update: {
          permissions: nextPermissions,
          cargoStoreParticipantId:
            upsertedActor?.storeParticipantId ?? existing?.cargoStoreParticipantId
        },
        include: consumerSkillInclude
      });
    });
  }

  async ensureConsumerSkills(d: {
    organization: Organization;
    instance: Instance;
    consumerSurface: ConsumerSurface;
    consumerProfile: ConsumerProfileForSkill;
    skills: Skill[];
    permissions: ConsumerSkillPermission[];
  }) {
    if (!d.skills.length) {
      return [];
    }

    let requestedPermissions = uniquePermissions(d.permissions);
    let existing = await db.consumerSkill.findMany({
      where: {
        consumerProfileOid: d.consumerProfile.oid,
        skillOid: {
          in: d.skills.map(skill => skill.oid)
        }
      }
    });
    let existingBySkillOid = new Map(
      existing.map(consumerSkill => [consumerSkill.skillOid.toString(), consumerSkill])
    );
    let needsEnsure = d.skills.filter(skill => {
      let consumerSkill = existingBySkillOid.get(skill.oid.toString());
      if (!consumerSkill) {
        return true;
      }

      if (requestedPermissions.includes('write') && !consumerSkill.cargoStoreParticipantId) {
        return true;
      }

      return requestedPermissions.some(
        permission => !consumerSkill.permissions.includes(permission)
      );
    });

    return await Promise.all(
      needsEnsure.map(skill =>
        this.ensureConsumerSkill({
          organization: d.organization,
          instance: d.instance,
          consumerSurface: d.consumerSurface,
          consumerProfile: d.consumerProfile,
          skill,
          permissions: requestedPermissions
        })
      )
    );
  }

  async createConsumerSkill(d: {
    organization: Organization;
    instance: Instance;
    consumerSurface: ConsumerSurface;
    consumerProfile: ConsumerProfileForSkill;
    consumerGroups: Pick<ConsumerGroup, 'oid'>[];
    input: ConsumerSkillCreateInput;
  }) {
    if (!d.consumerSurface.allowConsumerSkillAuthoring) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Consumers are not allowed to create skills on this surface.'
        })
      );
    }

    if (d.input.templateId) {
      await subspaceSkillTemplateService.get({
        instance: d.instance,
        consumerProfile: d.consumerProfile,
        consumerGroups: d.consumerGroups,
        skillTemplateId: d.input.templateId
      });
    }

    let skill = await subspaceSkillService.create({
      ...d.input,
      instance: d.instance,
      consumer: d.consumerProfile.consumer,
      consumerProfile: d.consumerProfile
    });
    let localSkill = await db.skill.findUniqueOrThrow({ where: { id: skill.id } });

    await this.ensureConsumerSkill({
      organization: d.organization,
      instance: d.instance,
      consumerSurface: d.consumerSurface,
      consumerProfile: d.consumerProfile,
      skill: localSkill,
      permissions: ['read', 'write']
    });

    return skill;
  }

  async forkConsumerSkill(d: {
    organization: Organization;
    instance: Instance;
    consumerSurface: ConsumerSurface;
    consumerProfile: ConsumerProfileForSkill;
    consumerGroups: Pick<ConsumerGroup, 'oid'>[];
    parentSkillId: string;
    input: ConsumerSkillForkInput;
  }) {
    if (!d.consumerSurface.allowConsumerSkillAuthoring) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Consumers are not allowed to fork skills on this surface.'
        })
      );
    }

    let parentSkill = await db.skill.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.parentSkillId,
        status: 'active'
      }
    });
    if (!parentSkill) {
      throw new ServiceError(notFoundError('skill', d.parentSkillId));
    }

    await this.assertConsumerCanReadSkill({
      skill: parentSkill,
      consumerProfile: d.consumerProfile,
      consumerGroups: d.consumerGroups
    });

    let skill = await subspaceSkillService.fork({
      ...d.input,
      instance: d.instance,
      consumer: d.consumerProfile.consumer,
      consumerProfile: d.consumerProfile,
      skillId: parentSkill.id
    });
    let localSkill = await db.skill.findUniqueOrThrow({ where: { id: skill.id } });

    await this.ensureConsumerSkill({
      organization: d.organization,
      instance: d.instance,
      consumerSurface: d.consumerSurface,
      consumerProfile: d.consumerProfile,
      skill: localSkill,
      permissions: ['read', 'write']
    });

    return skill;
  }

  async updateConsumerSkill(d: {
    organization: Organization;
    instance: Instance;
    consumerProfile: ConsumerProfileForSkill;
    skillId: string;
    input: ConsumerSkillUpdateInput;
  }) {
    let localSkill = await db.skill.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.skillId
      }
    });
    if (!localSkill) {
      throw new ServiceError(notFoundError('skill', d.skillId));
    }

    await this.assertConsumerCanWriteSkill({
      skill: localSkill,
      consumerProfile: d.consumerProfile
    });

    let skill = await subspaceSkillService.update({
      ...d.input,
      instance: d.instance,
      skillId: d.skillId,
      allowDeleted: true
    });

    return skill;
  }

  async deleteConsumerSkill(d: {
    organization: Organization;
    instance: Instance;
    consumerProfile: ConsumerProfileForSkill;
    skillId: string;
  }) {
    let localSkill = await db.skill.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.skillId
      }
    });
    if (!localSkill) {
      throw new ServiceError(notFoundError('skill', d.skillId));
    }

    await this.assertConsumerCanWriteSkill({
      skill: localSkill,
      consumerProfile: d.consumerProfile
    });

    let skill = await subspaceSkillService.delete({
      instance: d.instance,
      skillId: d.skillId,
      allowDeleted: true
    });

    return skill;
  }

  async publishConsumerSkill(d: {
    organization: Organization;
    instance: Instance;
    consumerSurface: ConsumerSurface;
    consumerProfile: ConsumerProfileForSkill;
    consumerGroups: ConsumerGroup[];
    skillId: string;
  }) {
    if (!d.consumerSurface.allowConsumerSkillPublishing) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Consumers are not allowed to publish skills on this surface.'
        })
      );
    }

    let skill = await db.skill.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.skillId,
        status: 'active'
      }
    });
    if (!skill) {
      throw new ServiceError(notFoundError('skill', d.skillId));
    }

    await this.assertConsumerCanWriteSkill({
      skill,
      consumerProfile: d.consumerProfile
    });

    let publishGroups = d.consumerGroups.filter(group => group.type !== 'user_access');

    for (let consumerGroup of publishGroups) {
      await consumerAccessService.createConsumerAccess({
        organization: d.organization,
        consumerSurface: d.consumerSurface,
        consumerGroup,
        access: {
          type: 'skill',
          skill
        }
      });
    }

    await consumerAccessPolicyService.grantAccess({
      organization: d.organization,
      permission: 'skill_read',
      subject: {
        personalConsumerGroupForProfile: d.consumerProfile
      },
      resource: {
        skill
      }
    });

    return await subspaceSkillService.get({
      instance: d.instance,
      consumerProfile: d.consumerProfile,
      consumerGroups: d.consumerGroups,
      skillId: d.skillId
    });
  }
}

export let consumerSkillService = Service.create(
  'consumerSkillService',
  () => new ConsumerSkillServiceImpl()
).build();
