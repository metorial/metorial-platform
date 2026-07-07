import {
  badRequestError,
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
  OrganizationActor,
  OrganizationMember,
  Prisma,
  Skill,
  withTransaction
} from '@metorial/db';
import { subspaceSkillService, subspaceSkillTemplateService } from '@metorial/module-subspace';
import { consumerAccessPolicyService } from '../consumerAccess/accessPolicy';
import { consumerAccessService } from '../consumerAccess/consumerAccess';

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
  imageFileId?: string | null;
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
  imageFileId?: string | null;
};

type SkillSharePermission = ConsumerSkillPermission | 'none';

export type SubspaceSkillListInput = Parameters<typeof subspaceSkillService.list>[0];

let withSubspaceUpsertActorOverride = (
  input: Parameters<typeof subspaceSkillService.upsertActor>[0] & {
    overridePermissions?: boolean;
  }
) => input as Parameters<typeof subspaceSkillService.upsertActor>[0];

let consumerAccessInclude = {
  consumerGroup: true,
  providerTemplate: true,
  magicMcpServer: true,
  skill: true,
  skillTemplate: true,
  skillGroup: true,
  skillMarketplace: true,
  listing: true
} as const;

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

let getContentPermissionsForConsumerSkill = (permissions: ConsumerSkillPermission[]) => {
  if (permissions.includes('write')) {
    return ['content_read', 'content_write'] satisfies Array<'content_read' | 'content_write'>;
  }

  if (permissions.includes('read')) {
    return ['content_read'] satisfies Array<'content_read' | 'content_write'>;
  }

  return [] satisfies Array<'content_read' | 'content_write'>;
};

let getUniqueIds = (ids?: string[]) => Array.from(new Set(ids ?? []));

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

  async assertConsumerCanWriteSkill(d: { skill: Skill; consumerProfile: ConsumerProfile }) {
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

  private async createConsumerPersonalSkillAccess(d: {
    organization: Organization;
    consumerSurface: ConsumerSurface;
    consumerProfile: Pick<ConsumerProfile, 'personalConsumerGroupOid'>;
    skill: Skill;
    permissions: ConsumerSkillPermission[];
  }) {
    let personalConsumerGroup = await db.consumerGroup.findUniqueOrThrow({
      where: {
        oid: d.consumerProfile.personalConsumerGroupOid
      }
    });

    let consumerAccess = await consumerAccessService.createConsumerAccess({
      organization: d.organization,
      consumerSurface: d.consumerSurface,
      consumerGroup: personalConsumerGroup,
      access: {
        type: 'skill',
        skill: d.skill
      }
    });

    if (d.permissions.includes('write')) {
      await consumerAccessPolicyService.grantAccess({
        organization: d.organization,
        permission: 'skill_write',
        subject: {
          consumerGroup: personalConsumerGroup
        },
        resource: {
          skill: d.skill
        },
        policyScope: {
          type: 'consumer_access',
          consumerAccessId: consumerAccess.id
        }
      });
    }

    return consumerAccess;
  }

  private getConsumerShareableGroups(consumerGroups: ConsumerGroup[]) {
    return consumerGroups.filter(group => group.type !== 'user_access');
  }

  private getProfileSharedGroupWhere(consumerGroups: ConsumerGroup[]) {
    let shareableGroups = this.getConsumerShareableGroups(consumerGroups);
    if (shareableGroups.some(group => group.isDefault)) {
      return undefined;
    }

    let groupOids = shareableGroups.map(group => group.oid);
    let ssoGroupIds = Array.from(
      new Set(shareableGroups.flatMap(group => group.ssoGroupIds ?? []))
    );
    let or: Prisma.ConsumerProfileWhereInput[] = [];

    if (groupOids.length) {
      or.push({
        groups: {
          some: {
            groupOid: {
              in: groupOids
            }
          }
        }
      });
    }

    if (ssoGroupIds.length) {
      or.push({
        ssoGroupIds: {
          hasSome: ssoGroupIds
        }
      });
    }

    if (!or.length) {
      return { id: { in: [] } } satisfies Prisma.ConsumerProfileWhereInput;
    }

    return { OR: or } satisfies Prisma.ConsumerProfileWhereInput;
  }

  private getPermissionsForShare(permission: SkillSharePermission) {
    if (permission == 'none') return [] as ConsumerSkillPermission[];
    return permission == 'write'
      ? (['read', 'write'] as ConsumerSkillPermission[])
      : (['read'] as ConsumerSkillPermission[]);
  }

  private assertCanSetConsumerSharePermission(d: {
    skill: Skill;
    consumerProfile: ConsumerProfile;
    permission: SkillSharePermission;
  }) {
    if (
      d.permission == 'none' &&
      d.skill.createdByConsumerProfileOid === d.consumerProfile.oid
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'The skill owner cannot be removed.'
        })
      );
    }
  }

  private assertCanSetOrganizationActorSharePermission(d: {
    skill: Skill;
    organizationActor: OrganizationActor;
    permission: SkillSharePermission;
  }) {
    if (
      d.permission == 'none' &&
      d.skill.createdByOrganizationActorOid === d.organizationActor.oid
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'The skill owner cannot be removed.'
        })
      );
    }
  }

  private async deleteConsumerPersonalSkillAccess(d: {
    organization: Organization;
    consumerProfile: Pick<ConsumerProfile, 'personalConsumerGroupOid'>;
    skill: Skill;
  }) {
    let accesses = await db.consumerAccess.findMany({
      where: {
        type: 'skill',
        skillOid: d.skill.oid,
        consumerGroupOid: d.consumerProfile.personalConsumerGroupOid
      },
      include: consumerAccessInclude
    });

    for (let access of accesses) {
      await consumerAccessService.deleteConsumerAccess({
        organization: d.organization,
        consumerAccess: access
      });
    }
  }

  private async setConsumerSkillSharePermission(d: {
    organization: Organization;
    instance: Instance;
    consumerSurface: ConsumerSurface;
    consumerProfile: ConsumerProfileForSkill;
    skill: Skill;
    permission: SkillSharePermission;
  }) {
    this.assertCanSetConsumerSharePermission({
      skill: d.skill,
      consumerProfile: d.consumerProfile,
      permission: d.permission
    });

    let permissions = this.getPermissionsForShare(d.permission);
    let contentPermissions = getContentPermissionsForConsumerSkill(permissions);
    let upsertedActor = await subspaceSkillService.upsertActor({
      ...withSubspaceUpsertActorOverride({
        instance: d.instance,
        skillId: d.skill.id,
        consumer: d.consumerProfile.consumer,
        permissions: contentPermissions,
        overridePermissions: true
      })
    });

    if (d.permission == 'none') {
      await withTransaction(async db => {
        await db.consumerSkill.deleteMany({
          where: {
            skillOid: d.skill.oid,
            consumerProfileOid: d.consumerProfile.oid,
            source: {
              not: 'owner'
            }
          }
        });
      });

      await this.deleteConsumerPersonalSkillAccess({
        organization: d.organization,
        consumerProfile: d.consumerProfile,
        skill: d.skill
      });
      return;
    }

    let consumerAccess = await this.createConsumerPersonalSkillAccess({
      organization: d.organization,
      consumerSurface: d.consumerSurface,
      consumerProfile: d.consumerProfile,
      skill: d.skill,
      permissions
    });
    if (!permissions.includes('write')) {
      await consumerAccessPolicyService.revokeAccess({
        organization: d.organization,
        permission: 'skill_write',
        subject: {
          consumerGroup: consumerAccess.consumerGroup
        },
        resource: {
          skill: d.skill
        },
        policyScope: {
          type: 'consumer_access',
          consumerAccessId: consumerAccess.id
        }
      });
    }

    await withTransaction(async db => {
      await db.consumerSkill.upsert({
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
          permissions,
          organizationOid: d.organization.oid,
          instanceOid: d.instance.oid,
          surfaceOid: d.consumerSurface.oid,
          consumerProfileOid: d.consumerProfile.oid,
          consumerOid: d.consumerProfile.consumerOid,
          skillOid: d.skill.oid,
          cargoStoreParticipantId: upsertedActor?.storeParticipantId ?? null
        },
        update: {
          permissions,
          cargoStoreParticipantId: upsertedActor?.storeParticipantId ?? null
        }
      });
    });
  }

  private async setOrganizationMemberSkillSharePermission(d: {
    instance: Instance;
    skill: Skill;
    member: OrganizationMember & { actor: OrganizationActor };
    permission: SkillSharePermission;
  }) {
    this.assertCanSetOrganizationActorSharePermission({
      skill: d.skill,
      organizationActor: d.member.actor,
      permission: d.permission
    });

    await subspaceSkillService.upsertActor({
      ...withSubspaceUpsertActorOverride({
        instance: d.instance,
        skillId: d.skill.id,
        organizationActor: d.member.actor,
        permissions: getContentPermissionsForConsumerSkill(
          this.getPermissionsForShare(d.permission)
        ),
        overridePermissions: true
      })
    });
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
    let contentPermissions = getContentPermissionsForConsumerSkill(nextPermissions);
    let upsertedActor = contentPermissions.length
      ? await subspaceSkillService.upsertActor({
          instance: d.instance,
          skillId: d.skill.id,
          consumer: d.consumerProfile.consumer,
          permissions: contentPermissions
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

      if (
        getContentPermissionsForConsumerSkill(requestedPermissions).length &&
        !consumerSkill.cargoStoreParticipantId
      ) {
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
    await this.createConsumerPersonalSkillAccess({
      organization: d.organization,
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
    await this.createConsumerPersonalSkillAccess({
      organization: d.organization,
      consumerSurface: d.consumerSurface,
      consumerProfile: d.consumerProfile,
      skill: localSkill,
      permissions: ['read', 'write']
    });

    return skill;
  }

  async shareSkill(d: {
    organization: Organization;
    instance: Instance;
    skill: Skill;
    permission: SkillSharePermission;
    consumerProfile?: ConsumerProfileForSkill;
    consumerGroups?: ConsumerGroup[];
    currentOrganizationMember?: OrganizationMember;
    targets: {
      consumerProfileIds?: string[];
      organizationMemberIds?: string[];
    };
  }) {
    let consumerProfileIds = getUniqueIds(d.targets.consumerProfileIds);
    let organizationMemberIds = getUniqueIds(d.targets.organizationMemberIds);

    if (!consumerProfileIds.length && !organizationMemberIds.length) {
      throw new ServiceError(
        badRequestError({
          message: 'At least one share target is required.'
        })
      );
    }

    if (d.consumerProfile) {
      await this.assertConsumerCanWriteSkill({
        skill: d.skill,
        consumerProfile: d.consumerProfile
      });

      if (consumerProfileIds.includes(d.consumerProfile.id)) {
        throw new ServiceError(
          forbiddenError({
            message: 'Consumers cannot change their own skill share access.'
          })
        );
      }

      if (organizationMemberIds.length) {
        throw new ServiceError(
          forbiddenError({
            message: 'Consumers cannot change organization member skill share access.'
          })
        );
      }
    }

    if (
      d.currentOrganizationMember &&
      organizationMemberIds.includes(d.currentOrganizationMember.id)
    ) {
      throw new ServiceError(
        forbiddenError({
          message: 'Organization members cannot change their own skill share access.'
        })
      );
    }

    if (consumerProfileIds.length) {
      let targetProfiles = await db.consumerProfile.findMany({
        where: {
          id: {
            in: consumerProfileIds
          },
          instanceOid: d.instance.oid,
          status: 'active',
          ...(d.consumerProfile
            ? {
                surfaceOid: d.consumerProfile.surfaceOid,
                ...this.getProfileSharedGroupWhere(d.consumerGroups ?? [])
              }
            : {})
        },
        include: {
          consumer: true,
          personalConsumerGroup: true,
          surface: true
        }
      });

      if (targetProfiles.length !== consumerProfileIds.length) {
        throw new ServiceError(notFoundError('consumer.profile'));
      }

      for (let targetProfile of targetProfiles) {
        await this.setConsumerSkillSharePermission({
          organization: d.organization,
          instance: d.instance,
          consumerSurface: targetProfile.surface,
          consumerProfile: targetProfile,
          skill: d.skill,
          permission: d.permission
        });
      }
    }

    if (organizationMemberIds.length) {
      let members = await db.organizationMember.findMany({
        where: {
          organizationOid: d.organization.oid,
          status: 'active',
          id: {
            in: organizationMemberIds
          },
          user: {
            type: {
              not: 'system'
            }
          }
        },
        include: {
          actor: true
        }
      });

      if (members.length !== organizationMemberIds.length) {
        throw new ServiceError(notFoundError('organization_member'));
      }

      for (let member of members as Array<OrganizationMember & { actor: OrganizationActor }>) {
        await this.setOrganizationMemberSkillSharePermission({
          instance: d.instance,
          skill: d.skill,
          member,
          permission: d.permission
        });
      }
    }
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
