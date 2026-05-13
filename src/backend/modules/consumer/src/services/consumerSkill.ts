import {
  forbiddenError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
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
  Skill,
  SkillStatus,
  withTransaction
} from '@metorial/db';
import { subspaceSkillService, type SubspaceSkill } from '@metorial/module-subspace';
import { consumerAccessPolicyService } from './accessPolicy';
import { consumerAccessService } from './consumerAccess';

let consumerSkillInclude = {
  skill: true
} as const;

type ConsumerProfileForSkill = ConsumerProfile & {
  consumer: Consumer;
};

type ConsumerSkillVisibilityInput = {
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

let statusFromSubspace = (status: SubspaceSkill['status']): SkillStatus => status;
let skillEntityIdFromSubspace = (skill: SubspaceSkill) => skill.hierarchy.entity.id;

let uniquePermissions = (permissions: ConsumerSkillPermission[]) => [...new Set(permissions)];

class ConsumerSkillServiceImpl {
  private getVisibleSkillWhere(d: ConsumerSkillVisibilityInput) {
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
        }
      ]
    };
  }

  private async assertConsumerCanReadSkill(d: {
    skill: Skill;
    consumerProfile: ConsumerProfile;
    consumerGroups: Pick<ConsumerGroup, 'oid'>[];
  }) {
    let localSkill = await db.skill.findFirst({
      where: {
        oid: d.skill.oid,
        ...this.getVisibleSkillWhere(d)
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

  async syncSkillFromSubspace(d: {
    organization: Organization;
    instance: Instance;
    skill: SubspaceSkill;
    owner?: {
      consumerProfile?: ConsumerProfileForSkill;
    };
  }) {
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
        organizationOid: d.organization.oid,
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
  }

  private async hydrateSubspaceSkills(d: { instance: Instance; skills: Skill[] }) {
    if (!d.skills.length) {
      return [];
    }

    let hydrated = await subspaceSkillService.getMany({
      instance: d.instance,
      skillIds: d.skills.map(skill => skill.id),
      allowDeleted: true
    });
    let byId = new Map(hydrated.map(skill => [skill.id, skill]));

    return d.skills
      .map(skill => byId.get(skill.id))
      .filter((skill): skill is SubspaceSkill => !!skill);
  }

  async listConsumerSkills(d: {
    organization: Organization;
    instance: Instance;
    consumerSurface: ConsumerSurface;
    consumerProfile: ConsumerProfileForSkill;
    consumerGroups: Pick<ConsumerGroup, 'oid'>[];
    search?: string;
    status?: SkillStatus[];
    ids?: string[];
  }) {
    let search = d.search?.trim();

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let skills = await db.skill.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,
            status: d.status?.length ? { in: d.status } : 'active',
            id: d.ids?.length ? { in: d.ids } : undefined,
            name: search
              ? {
                  contains: search,
                  mode: 'insensitive'
                }
              : undefined,
            ...this.getVisibleSkillWhere(d)
          }
        });

        let hydrated = await this.hydrateSubspaceSkills({
          instance: d.instance,
          skills
        });

        await this.ensureConsumerSkills({
          organization: d.organization,
          instance: d.instance,
          consumerSurface: d.consumerSurface,
          consumerProfile: d.consumerProfile,
          skills,
          permissions: ['read']
        });

        return hydrated;
      })
    );
  }

  async getConsumerSkill(d: {
    organization: Organization;
    instance: Instance;
    consumerSurface: ConsumerSurface;
    consumerProfile: ConsumerProfileForSkill;
    consumerGroups: Pick<ConsumerGroup, 'oid'>[];
    skillId: string;
    allowDeleted?: boolean;
  }) {
    let skill = await db.skill.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.skillId,
        ...(d.allowDeleted ? {} : { status: 'active' as const })
      }
    });
    if (!skill) {
      throw new ServiceError(notFoundError('skill', d.skillId));
    }

    await this.assertConsumerCanReadSkill({
      skill,
      consumerProfile: d.consumerProfile,
      consumerGroups: d.consumerGroups
    });

    let subspaceSkill = await subspaceSkillService.get({
      instance: d.instance,
      skillId: skill.id,
      allowDeleted: d.allowDeleted
    });

    await this.syncSkillFromSubspace({
      organization: d.organization,
      instance: d.instance,
      skill: subspaceSkill
    });

    await this.ensureConsumerSkill({
      organization: d.organization,
      instance: d.instance,
      consumerSurface: d.consumerSurface,
      consumerProfile: d.consumerProfile,
      skill,
      permissions: ['read']
    });

    return subspaceSkill;
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
    input: ConsumerSkillCreateInput;
  }) {
    if (!d.consumerSurface.allowConsumerSkillAuthoring) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Consumers are not allowed to create skills on this surface.'
        })
      );
    }

    let skill = await subspaceSkillService.create({
      ...d.input,
      instance: d.instance,
      consumer: d.consumerProfile.consumer
    });
    let localSkill = await this.syncSkillFromSubspace({
      organization: d.organization,
      instance: d.instance,
      skill,
      owner: {
        consumerProfile: d.consumerProfile
      }
    });

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
      skillId: parentSkill.id
    });
    let localSkill = await this.syncSkillFromSubspace({
      organization: d.organization,
      instance: d.instance,
      skill,
      owner: {
        consumerProfile: d.consumerProfile
      }
    });

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

    await this.syncSkillFromSubspace({
      organization: d.organization,
      instance: d.instance,
      skill
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

    await this.syncSkillFromSubspace({
      organization: d.organization,
      instance: d.instance,
      skill
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

    return await this.getConsumerSkill({
      organization: d.organization,
      instance: d.instance,
      consumerSurface: d.consumerSurface,
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
