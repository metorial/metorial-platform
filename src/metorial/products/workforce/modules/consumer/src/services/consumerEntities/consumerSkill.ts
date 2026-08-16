import {
  badRequestError,
  forbiddenError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  skillParticipantService,
  skillResourceService,
  skillService,
  type SkillRecord
} from '@metorial/module-skill';
import { skillTemplateService } from '@metorial/module-skill-templates';
import {
  Consumer,
  ConsumerGroup,
  ConsumerProfile,
  ConsumerSurface,
  db,
  ID,
  Instance,
  Organization,
  Prisma,
  Project,
  Skill,
  withTransaction
} from '@metorial/db';
import {
  accessTagService,
  consumerSkillManageAccessRoles,
  createResourceAuthorization
} from '@metorial/module-access';
import { resourceActorService } from '@metorial/module-resource-actor';
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

type SkillSharePermission = 'read' | 'write' | 'none';

let getUniqueIds = (ids?: string[]) => Array.from(new Set(ids ?? []));

class ConsumerSkillServiceImpl {
  private async getConsumerActor(d: { instance: Instance; consumerProfile: ConsumerProfile }) {
    let project = await db.project.findUniqueOrThrow({
      where: { oid: d.instance.projectOid }
    });

    let actor = await resourceActorService.ensureConsumerProfileActor({
      project,
      consumerProfile: d.consumerProfile
    });

    return {
      scope: {
        instance: d.instance,
        project
      },
      actor
    };
  }

  private async getConsumerWriteAccessTags(
    consumerProfile: Pick<
      ConsumerProfile,
      'oid' | 'personalConsumerGroupOid' | 'surfaceOid' | 'ssoGroupIds'
    >
  ) {
    let effectiveGroups = await db.consumerGroup.findMany({
      where: {
        surfaceOid: consumerProfile.surfaceOid,
        status: 'active',
        OR: [
          { oid: consumerProfile.personalConsumerGroupOid },
          { isDefault: true },
          { profiles: { some: { profileOid: consumerProfile.oid } } },
          ...(consumerProfile.ssoGroupIds.length
            ? [{ ssoGroupIds: { hasSome: consumerProfile.ssoGroupIds } }]
            : [])
        ]
      },
      select: {
        accessTagOid: true
      }
    });

    return Array.from(new Set(effectiveGroups.map(group => group.accessTagOid)));
  }

  async assertConsumerCanManageSkillAccess(d: {
    skill: Skill;
    consumerProfile: ConsumerProfile;
  }) {
    let accessTagFilter = await accessTagService.getAccessTagFilter({
      tags: await this.getConsumerWriteAccessTags(d.consumerProfile),
      roles: [...consumerSkillManageAccessRoles]
    });
    let manageableSkill = await db.skill.findFirst({
      where: {
        oid: d.skill.oid,
        accessTagEntities: accessTagFilter
      },
      select: {
        oid: true
      }
    });

    if (!manageableSkill) {
      throw new ServiceError(
        forbiddenError({
          message: 'Consumer does not have permission to manage access to this skill.'
        })
      );
    }
  }

  private async createConsumerPersonalSkillAccess(d: {
    organization: Organization;
    instance: Instance;
    consumerProfile: ConsumerProfile;
    skill: Skill;
    permission: Exclude<SkillSharePermission, 'none'>;
    grantManageAccess?: boolean;
  }) {
    let { actor } = await this.getConsumerActor({
      instance: d.instance,
      consumerProfile: d.consumerProfile
    });
    let participant = await skillParticipantService.setSkillParticipantAccessRole({
      skill: d.skill,
      actor,
      permission: d.permission
    });
    if (!participant) {
      throw new ServiceError(notFoundError('skill.participant'));
    }
    await this.grantConsumerPersonalSkillAccess({
      organization: d.organization,
      consumerProfile: d.consumerProfile,
      skill: d.skill,
      participant,
      permission: d.permission,
      grantManageAccess: d.grantManageAccess
    });
  }

  private async grantConsumerPersonalSkillAccess(d: {
    organization: Organization;
    consumerProfile: Pick<ConsumerProfile, 'personalConsumerGroupOid'>;
    skill: Pick<Skill, 'oid'>;
    participant: { id: string };
    permission: Exclude<SkillSharePermission, 'none'>;
    grantManageAccess?: boolean;
  }) {
    let policyScope = {
      type: 'skill_participant' as const,
      skillParticipantId: d.participant.id
    };
    await consumerAccessPolicyService.grantAccess({
      organization: d.organization,
      permission: 'skill_read',
      subject: {
        personalConsumerGroupForProfile: d.consumerProfile
      },
      resource: {
        skill: d.skill
      },
      policyScope
    });

    if (d.permission == 'write') {
      await consumerAccessPolicyService.grantAccess({
        organization: d.organization,
        permission: 'skill_write',
        subject: {
          personalConsumerGroupForProfile: d.consumerProfile
        },
        resource: {
          skill: d.skill
        },
        policyScope
      });
    }
    if (d.grantManageAccess) {
      await consumerAccessPolicyService.grantAccess({
        organization: d.organization,
        permission: 'skill_manage_access',
        subject: {
          personalConsumerGroupForProfile: d.consumerProfile
        },
        resource: {
          skill: d.skill
        },
        policyScope
      });
    }
  }

  async grantImportedSkillAccess(d: { consumerProfileOid: bigint; skill: Skill }) {
    let consumerProfile = await db.consumerProfile.findUnique({
      where: { oid: d.consumerProfileOid },
      include: {
        consumer: true,
        surface: {
          include: {
            organization: true
          }
        },
        instance: true
      }
    });
    if (!consumerProfile || consumerProfile.status !== 'active') {
      throw new ServiceError(
        notFoundError('consumerProfile', d.consumerProfileOid.toString())
      );
    }

    return await this.createConsumerPersonalSkillAccess({
      organization: consumerProfile.surface.organization,
      instance: consumerProfile.instance,
      consumerProfile,
      skill: d.skill,
      permission: 'write',
      grantManageAccess: true
    });
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
    skill: Skill;
    actor: { oid: bigint };
    permission: SkillSharePermission;
  }) {
    if (d.permission == 'write') return;

    let isOwner = d.skill.createdByResourceActorOid === d.actor.oid;

    if (isOwner) {
      throw new ServiceError(
        badRequestError({
          message: 'The skill owner cannot be removed or downgraded.'
        })
      );
    }
  }

  private async deleteLegacyPersonalConsumerAccess(d: {
    database: Prisma.TransactionClient;
    organization: Organization;
    consumerProfile: Pick<ConsumerProfile, 'personalConsumerGroupOid'>;
    skill: Pick<Skill, 'oid'>;
  }) {
    let accesses = await d.database.consumerAccess.findMany({
      where: {
        type: 'skill',
        consumerGroupOid: d.consumerProfile.personalConsumerGroupOid,
        skillOid: d.skill.oid
      },
      include: {
        consumerGroup: true,
        providerTemplate: true,
        magicMcpServer: true,
        skill: true,
        skillTemplate: true,
        skillGroup: true,
        skillMarketplace: true,
        listing: true
      }
    });

    for (let consumerAccess of accesses) {
      await consumerAccessService.deleteConsumerAccess({
        organization: d.organization,
        consumerAccess
      });
    }
  }

  private async setConsumerSkillSharePermission(d: {
    organization: Organization;
    instance: Instance;
    consumerProfile: ConsumerProfileForSkill;
    skill: SkillRecord;
    permission: SkillSharePermission;
  }) {
    let { actor } = await this.getConsumerActor({
      instance: d.instance,
      consumerProfile: d.consumerProfile
    });
    await this.assertCanSetConsumerSharePermission({
      skill: d.skill,
      actor,
      permission: d.permission
    });

    await withTransaction(async database => {
      let participant = await skillParticipantService.setSkillParticipantAccessRole({
        skill: d.skill,
        actor,
        permission: d.permission
      });
      await this.deleteLegacyPersonalConsumerAccess({
        database,
        organization: d.organization,
        consumerProfile: d.consumerProfile,
        skill: d.skill
      });
      await consumerAccessPolicyService.revokeSkillParticipantAccessForPersonalGroup({
        organization: d.organization,
        consumerProfile: d.consumerProfile,
        skill: d.skill
      });
      if (!participant || d.permission == 'none') return;

      await this.grantConsumerPersonalSkillAccess({
        organization: d.organization,
        consumerProfile: d.consumerProfile,
        skill: d.skill,
        participant,
        permission: d.permission
      });
    });
  }

  async createConsumerSkill(d: {
    organization: Organization;
    instance: Instance;
    project: Project;
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

    let actor = await resourceActorService.ensureConsumerProfileActor({
      project: d.project,
      consumerProfile: d.consumerProfile
    });

    let template = d.input.templateId
      ? await skillTemplateService.getSkillTemplateById({
          project: d.project,
          instance: d.instance,
          skillTemplateId: d.input.templateId,
          accessTags: d.consumerGroups.map(group => group.accessTagOid)
        })
      : await skillTemplateService.getDefaultSkillTemplate({
          project: d.project,
          instance: d.instance
        });

    let localSkill = await skillService.createSkill({
      instance: d.instance,
      project: d.project,
      parentSkillTemplate: template,
      input: {
        id: await ID.generateId('skill'),
        authorization: createResourceAuthorization({
          restricted: true,
          resourceActor: actor,
          accessTags: d.consumerGroups.map(group => ({
            accessTagOid: group.accessTagOid
          })),
          project: d.project,
          instance: d.instance,
          consumerProfile: d.consumerProfile
        }),
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
      instance: d.instance,
      consumerProfile: d.consumerProfile,
      skill: localSkill,
      permission: 'write',
      grantManageAccess: true
    });

    return await skillResourceService.hydrateSkill(localSkill);
  }

  async forkConsumerSkill(d: {
    organization: Organization;
    instance: Instance;
    project: Project;
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

    let actor = await resourceActorService.ensureConsumerProfileActor({
      project: d.project,
      consumerProfile: d.consumerProfile
    });
    let parentSkill = await skillService.getSkillById({
      project: d.project,
      instance: d.instance,
      skillId: d.parentSkillId,
      accessTags: d.consumerGroups.map(group => group.accessTagOid)
    });
    let localSkill = await skillService.createSkill({
      project: d.project,
      instance: d.instance,
      parentSkill,
      parentSkillCloneType: 'fork',
      input: {
        id: await ID.generateId('skill'),
        authorization: createResourceAuthorization({
          restricted: true,
          resourceActor: actor,
          accessTags: d.consumerGroups.map(group => ({
            accessTagOid: group.accessTagOid
          })),
          project: d.project,
          instance: d.instance,
          consumerProfile: d.consumerProfile
        }),
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
      sourceSkill: parentSkill,
      targetSkill: localSkill
    });
    await this.createConsumerPersonalSkillAccess({
      organization: d.organization,
      instance: d.instance,
      consumerProfile: d.consumerProfile,
      skill: localSkill,
      permission: 'write',
      grantManageAccess: true
    });

    return await skillResourceService.hydrateSkill(localSkill);
  }

  async shareSkill(d: {
    organization: Organization;
    instance: Instance;
    skill: SkillRecord;
    permission: SkillSharePermission;
    consumerProfile?: ConsumerProfileForSkill;
    consumerGroups?: ConsumerGroup[];
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
    if (organizationMemberIds.length) {
      throw new ServiceError(
        forbiddenError({
          message: 'Organization member skill access is privileged and cannot be changed.'
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

      await this.assertConsumerCanManageSkillAccess({
        skill: d.skill,
        consumerProfile: d.consumerProfile
      });
    }

    if (!consumerProfileIds.length) return;

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
        consumerProfile: targetProfile,
        skill: d.skill,
        permission: d.permission
      });
    }
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

    let [{ scope, actor }, accessTags] = await Promise.all([
      this.getConsumerActor({
        instance: d.instance,
        consumerProfile: d.consumerProfile
      }),
      this.getConsumerWriteAccessTags(d.consumerProfile)
    ]);

    let skill = await skillService.getSkillById({
      ...scope,
      skillId: d.skillId
    });
    await skillService.assertSkillWriteAccess({
      ...scope,
      skill,
      authorization: createResourceAuthorization({
        restricted: true,
        resourceActor: actor,
        accessTags,
        ...scope,
        instance: d.instance,
        consumerProfile: d.consumerProfile
      })
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

    return await skillResourceService.hydrateSkill(skill);
  }
}

export let consumerSkillService = Service.create(
  'consumerSkillService',
  () => new ConsumerSkillServiceImpl()
).build();
