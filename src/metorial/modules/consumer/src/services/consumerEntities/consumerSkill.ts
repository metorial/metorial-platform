import {
  badRequestError,
  forbiddenError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  skillResourceService,
  skillService,
  skillTemplateService
} from '@metorial/cargo-module-skill';
import {
  Consumer,
  ConsumerGroup,
  ConsumerProfile,
  ConsumerSurface,
  db,
  ID,
  Instance,
  Organization,
  OrganizationActor,
  OrganizationMember,
  Prisma,
  Skill
} from '@metorial/db';
import { accessTagService, consumerSkillWriteRoles } from '@metorial/module-access';
import {
  resourceActorService,
  resolveResourceScopeForOwner
} from '@metorial/module-resource-tenant';
import { consumerAccessPolicyService } from '../consumerAccess/accessPolicy';
import { consumerAccessService } from '../consumerAccess/consumerAccess';

export type ConsumerProfileForSkill = ConsumerProfile & {
  consumer: Consumer;
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
  templateId?: string;
  imageFileId?: string | null;
};

type ConsumerSkillForkInput = ConsumerSkillCreateInput;

type ConsumerSkillUpdateInput = {
  name?: string;
  description?: string | null;
  clientName?: string;
  clientDescription?: string;
  license?: string | null;
  compatibility?: string | null;
  clientMetadata?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  imageFileId?: string | null;
};

type SkillSharePermission = 'read' | 'write' | 'none';

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

let getContentPermissionsForShare = (permission: SkillSharePermission) => {
  if (permission == 'write') {
    return ['content_read', 'content_write'] satisfies Array<'content_read' | 'content_write'>;
  }

  if (permission == 'read') {
    return ['content_read'] satisfies Array<'content_read' | 'content_write'>;
  }

  return [] satisfies Array<'content_read' | 'content_write'>;
};

let getUniqueIds = (ids?: string[]) => Array.from(new Set(ids ?? []));

class ConsumerSkillServiceImpl {
  private async getNativeSkillContext(d: { instance: Pick<Instance, 'id'>; skill: Skill }) {
    let scope = await resolveResourceScopeForOwner({
      type: 'instance',
      instance: d.instance
    });
    let skill = await skillService.getSkillById({
      ...scope,
      skillId: d.skill.id,
      allowDeleted: true
    });

    return { scope, skill };
  }

  private async getConsumerActor(d: {
    instance: Pick<Instance, 'id'>;
    consumerProfile: Pick<ConsumerProfile, 'consumerOid'>;
  }) {
    let scope = await resolveResourceScopeForOwner({
      type: 'instance',
      instance: d.instance
    });
    let actor = await resourceActorService.ensureConsumerActor({
      resourceTenant: scope.resourceTenant,
      consumerOid: d.consumerProfile.consumerOid
    });

    return { scope, actor };
  }

  private async getConsumerWriteAccessTags(
    consumerProfile: Pick<ConsumerProfile, 'accessTagOid' | 'personalConsumerGroupOid'>
  ) {
    let personalConsumerGroup = await db.consumerGroup.findUniqueOrThrow({
      where: {
        oid: consumerProfile.personalConsumerGroupOid
      },
      select: {
        accessTagOid: true
      }
    });

    return [consumerProfile.accessTagOid, personalConsumerGroup.accessTagOid];
  }

  private async assertConsumerCanReadSkill(d: {
    skill: Skill;
    consumerProfile: ConsumerProfile;
    consumerGroups: Pick<ConsumerGroup, 'oid' | 'accessTagOid'>[];
  }) {
    let scope = await resolveResourceScopeForOwner({
      type: 'instance',
      instance: await db.instance.findUniqueOrThrow({
        where: { oid: d.skill.instanceOid! }
      })
    });
    await skillService.getSkillById({
      ...scope,
      skillId: d.skill.id,
      accessTags: [
        d.consumerProfile.accessTagOid,
        ...d.consumerGroups.map(group => group.accessTagOid)
      ],
      consumerProfileOid: d.consumerProfile.oid
    });
  }

  async assertConsumerCanWriteSkill(d: { skill: Skill; consumerProfile: ConsumerProfile }) {
    let instance = await db.instance.findUniqueOrThrow({
      where: { oid: d.skill.instanceOid! }
    });
    let [{ actor }, accessTags] = await Promise.all([
      this.getConsumerActor({
        instance,
        consumerProfile: d.consumerProfile
      }),
      this.getConsumerWriteAccessTags(d.consumerProfile)
    ]);
    let accessTagFilter = await accessTagService.getAccessTagFilter({
      tags: accessTags,
      roles: [...consumerSkillWriteRoles]
    });
    let writableSkill = await db.skill.findFirst({
      where: {
        oid: d.skill.oid,
        OR: [
          { createdByResourceActorOid: actor.oid },
          { createdByConsumerOid: d.consumerProfile.consumerOid },
          { createdByConsumerProfileOid: d.consumerProfile.oid },
          { accessTagEntities: accessTagFilter }
        ]
      },
      select: {
        oid: true
      }
    });

    if (!writableSkill) {
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
    permission: Exclude<SkillSharePermission, 'none'>;
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

    if (d.permission == 'write') {
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

  private async assertCanSetConsumerSharePermission(d: {
    instance: Instance;
    skill: Skill;
    consumerProfile: ConsumerProfile;
    permission: SkillSharePermission;
  }) {
    if (d.permission == 'write') return;

    let { actor } = await this.getConsumerActor({
      instance: d.instance,
      consumerProfile: d.consumerProfile
    });
    let isOwner =
      d.skill.createdByResourceActorOid === actor.oid ||
      d.skill.createdByConsumerOid === d.consumerProfile.consumerOid ||
      d.skill.createdByConsumerProfileOid === d.consumerProfile.oid;

    if (isOwner) {
      throw new ServiceError(
        badRequestError({
          message: 'The skill owner cannot be removed or downgraded.'
        })
      );
    }
  }

  private async assertCanSetOrganizationActorSharePermission(d: {
    instance: Instance;
    skill: Skill;
    organizationActor: OrganizationActor;
    permission: SkillSharePermission;
  }) {
    if (d.permission == 'write') return;

    let scope = await resolveResourceScopeForOwner({
      type: 'instance',
      instance: d.instance
    });
    let actor = await resourceActorService.ensureOrganizationActor({
      resourceTenant: scope.resourceTenant,
      organizationActorOid: d.organizationActor.oid
    });
    let isOwner =
      d.skill.createdByResourceActorOid === actor.oid ||
      d.skill.createdByOrganizationActorOid === d.organizationActor.oid;

    if (isOwner) {
      throw new ServiceError(
        badRequestError({
          message: 'The skill owner cannot be removed or downgraded.'
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
    await this.assertCanSetConsumerSharePermission({
      instance: d.instance,
      skill: d.skill,
      consumerProfile: d.consumerProfile,
      permission: d.permission
    });

    if (d.permission == 'none') {
      await this.deleteConsumerPersonalSkillAccess({
        organization: d.organization,
        consumerProfile: d.consumerProfile,
        skill: d.skill
      });

      await this.syncConsumerSkillParticipantProjection({
        instance: d.instance,
        skill: d.skill,
        consumerProfile: d.consumerProfile,
        permission: d.permission
      });
      return;
    }

    let consumerAccess = await this.createConsumerPersonalSkillAccess({
      organization: d.organization,
      consumerSurface: d.consumerSurface,
      consumerProfile: d.consumerProfile,
      skill: d.skill,
      permission: d.permission
    });
    if (d.permission == 'read') {
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

    await this.syncConsumerSkillParticipantProjection({
      instance: d.instance,
      skill: d.skill,
      consumerProfile: d.consumerProfile,
      permission: d.permission
    });
  }

  private async syncConsumerSkillParticipantProjection(d: {
    instance: Pick<Instance, 'id'>;
    skill: Skill;
    consumerProfile: Pick<ConsumerProfile, 'consumerOid'>;
    permission: SkillSharePermission;
  }) {
    let [{ scope, skill }, { actor }] = await Promise.all([
      this.getNativeSkillContext({
        instance: d.instance,
        skill: d.skill
      }),
      this.getConsumerActor({
        instance: d.instance,
        consumerProfile: d.consumerProfile
      })
    ]);

    await skillService.upsertSkillActor({
      ...scope,
      skill,
      actorId: actor.id,
      permissions: getContentPermissionsForShare(d.permission),
      overridePermissions: true
    });
  }

  async reconcileSkillShareParticipants(d: { instance: Instance; skill: Skill }) {
    let { scope, skill } = await this.getNativeSkillContext({
      instance: d.instance,
      skill: d.skill
    });
    let consumerAccesses = await db.consumerAccess.findMany({
      where: {
        type: 'skill',
        skillOid: d.skill.oid,
        consumerGroup: {
          personalOwner: {
            is: {
              status: 'active'
            }
          }
        }
      },
      include: {
        consumerGroup: {
          include: {
            personalOwner: true
          }
        }
      }
    });
    let accessTagOids = consumerAccesses.map(access => access.consumerGroup.accessTagOid);
    let writeAccessTagEntities = accessTagOids.length
      ? await db.accessTagEntity.findMany({
          where: {
            skillOid: d.skill.oid,
            accessTagOid: {
              in: accessTagOids
            },
            accessTagPolicy: {
              roles: {
                hasSome: [...consumerSkillWriteRoles]
              }
            }
          },
          select: {
            accessTagOid: true
          }
        })
      : [];
    let writeAccessTagOids = new Set(
      writeAccessTagEntities.map(entity => entity.accessTagOid.toString())
    );
    let permissionByConsumerOid = new Map<bigint, Exclude<SkillSharePermission, 'none'>>();

    for (let access of consumerAccesses) {
      let profile = access.consumerGroup.personalOwner;
      if (!profile) continue;

      let permission: Exclude<SkillSharePermission, 'none'> = writeAccessTagOids.has(
        access.consumerGroup.accessTagOid.toString()
      )
        ? 'write'
        : 'read';
      let existing = permissionByConsumerOid.get(profile.consumerOid);
      if (existing != 'write') {
        permissionByConsumerOid.set(profile.consumerOid, permission);
      }
    }

    let consumerStoreParticipants = await db.storeParticipant.findMany({
      where: {
        storeOid: skill.storeOid!,
        resourceActor: {
          consumerOid: {
            not: null
          }
        }
      },
      include: {
        resourceActor: true
      }
    });
    let participantByConsumerOid = new Map(
      consumerStoreParticipants
        .filter(participant => participant.resourceActor.consumerOid != null)
        .map(participant => [participant.resourceActor.consumerOid!, participant])
    );

    for (let [consumerOid, permission] of permissionByConsumerOid) {
      let permissions = getContentPermissionsForShare(permission);
      let existing = participantByConsumerOid.get(consumerOid);
      participantByConsumerOid.delete(consumerOid);
      if (
        existing &&
        existing.permissions.length == permissions.length &&
        permissions.every(item => existing.permissions.includes(item))
      ) {
        continue;
      }
      let actor =
        existing?.resourceActor ??
        (await resourceActorService.ensureConsumerActor({
          resourceTenant: scope.resourceTenant,
          consumerOid
        }));

      await skillService.upsertSkillActor({
        ...scope,
        skill,
        actorId: actor.id,
        permissions,
        overridePermissions: true
      });
    }

    for (let participant of participantByConsumerOid.values()) {
      if (participant.permissions.length == 0) continue;
      await skillService.upsertSkillActor({
        ...scope,
        skill,
        actorId: participant.resourceActor.id,
        permissions: [],
        overridePermissions: true
      });
    }
  }

  private async setOrganizationMemberSkillSharePermission(d: {
    instance: Instance;
    skill: Skill;
    member: OrganizationMember & { actor: OrganizationActor };
    permission: SkillSharePermission;
  }) {
    await this.assertCanSetOrganizationActorSharePermission({
      instance: d.instance,
      skill: d.skill,
      organizationActor: d.member.actor,
      permission: d.permission
    });

    let { scope, skill } = await this.getNativeSkillContext({
      instance: d.instance,
      skill: d.skill
    });
    let actor = await resourceActorService.ensureOrganizationActor({
      resourceTenant: scope.resourceTenant,
      organizationActorOid: d.member.actor.oid
    });
    await skillService.upsertSkillActor({
      ...scope,
      skill,
      actorId: actor.id,
      permissions: getContentPermissionsForShare(d.permission),
      overridePermissions: true
    });
  }

  async createConsumerSkill(d: {
    organization: Organization;
    instance: Instance;
    consumerSurface: ConsumerSurface;
    consumerProfile: ConsumerProfileForSkill;
    consumerGroups: Pick<ConsumerGroup, 'oid' | 'accessTagOid'>[];
    input: ConsumerSkillCreateInput;
  }) {
    if (!d.consumerSurface.allowConsumerSkillAuthoring) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Consumers are not allowed to create skills on this surface.'
        })
      );
    }

    let scope = await resolveResourceScopeForOwner({
      type: 'instance',
      instance: d.instance
    });
    let actor = await resourceActorService.ensureConsumerActor({
      resourceTenant: scope.resourceTenant,
      consumerOid: d.consumerProfile.consumerOid
    });
    let template = d.input.templateId
      ? await skillTemplateService.getSkillTemplateById({
          ...scope,
          skillTemplateId: d.input.templateId,
          accessTags: [
            d.consumerProfile.accessTagOid,
            ...d.consumerGroups.map(group => group.accessTagOid)
          ]
        })
      : await skillTemplateService.getDefaultSkillTemplate(scope);
    let localSkill = await skillService.createSkill({
      ...scope,
      parentSkillTemplate: template,
      input: {
        id: await ID.generateId('skill'),
        actorId: actor.id,
        name: d.input.name,
        description: d.input.description,
        clientName: d.input.clientName,
        clientDescription: d.input.clientDescription,
        license: d.input.license,
        compatibility: d.input.compatibility,
        clientMetadata: d.input.clientMetadata as any,
        metadata: d.input.metadata as any,
        imageFileId: d.input.imageFileId
      }
    });
    if (template) {
      await skillResourceService.copyDelegatedTemplateResourcesToSkill({
        skillTemplate: template,
        skill: localSkill
      });
    }
    await this.createConsumerPersonalSkillAccess({
      organization: d.organization,
      consumerSurface: d.consumerSurface,
      consumerProfile: d.consumerProfile,
      skill: localSkill,
      permission: 'write'
    });

    return await skillResourceService.hydrateSkill(localSkill);
  }

  async forkConsumerSkill(d: {
    organization: Organization;
    instance: Instance;
    consumerSurface: ConsumerSurface;
    consumerProfile: ConsumerProfileForSkill;
    consumerGroups: Pick<ConsumerGroup, 'oid' | 'accessTagOid'>[];
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

    let scope = await resolveResourceScopeForOwner({
      type: 'instance',
      instance: d.instance
    });
    let actor = await resourceActorService.ensureConsumerActor({
      resourceTenant: scope.resourceTenant,
      consumerOid: d.consumerProfile.consumerOid
    });
    let parentCargoSkill = await skillService.getSkillById({
      ...scope,
      skillId: parentSkill.id
    });
    let localSkill = await skillService.createSkill({
      ...scope,
      parentSkill: parentCargoSkill,
      parentSkillCloneType: 'fork',
      input: {
        id: await ID.generateId('skill'),
        actorId: actor.id,
        name: d.input.name,
        description: d.input.description,
        clientName: d.input.clientName,
        clientDescription: d.input.clientDescription,
        license: d.input.license,
        compatibility: d.input.compatibility,
        clientMetadata: d.input.clientMetadata as any,
        metadata: d.input.metadata as any,
        imageFileId: d.input.imageFileId
      }
    });
    await skillResourceService.copyDelegatedSkillResources({
      sourceSkill: parentCargoSkill,
      targetSkill: localSkill
    });
    await this.createConsumerPersonalSkillAccess({
      organization: d.organization,
      consumerSurface: d.consumerSurface,
      consumerProfile: d.consumerProfile,
      skill: localSkill,
      permission: 'write'
    });

    return await skillResourceService.hydrateSkill(localSkill);
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

      await this.assertConsumerCanWriteSkill({
        skill: d.skill,
        consumerProfile: d.consumerProfile
      });
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

    let [{ scope, actor }, accessTags] = await Promise.all([
      this.getConsumerActor({
        instance: d.instance,
        consumerProfile: d.consumerProfile
      }),
      this.getConsumerWriteAccessTags(d.consumerProfile)
    ]);
    let cargoSkill = await skillService.getSkillById({ ...scope, skillId: d.skillId });
    let updated = await skillService.updateSkill({
      ...scope,
      skill: cargoSkill,
      actorId: actor.id,
      accessTags,
      input: d.input as any
    });
    return await skillResourceService.hydrateSkill(updated);
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

    let [{ scope, actor }, accessTags] = await Promise.all([
      this.getConsumerActor({
        instance: d.instance,
        consumerProfile: d.consumerProfile
      }),
      this.getConsumerWriteAccessTags(d.consumerProfile)
    ]);
    let cargoSkill = await skillService.getSkillById({ ...scope, skillId: d.skillId });
    let archived = await skillService.archiveSkill({
      ...scope,
      skill: cargoSkill,
      actorId: actor.id,
      accessTags
    });
    return await skillResourceService.hydrateSkill(archived);
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

    return await skillResourceService.hydrateSkill(skill);
  }
}

export let consumerSkillService = Service.create(
  'consumerSkillService',
  () => new ConsumerSkillServiceImpl()
).build();
