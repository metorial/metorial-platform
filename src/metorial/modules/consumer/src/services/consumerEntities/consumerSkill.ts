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
  skillTemplateService,
  type SkillRecord
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
  Skill,
  withTransaction
} from '@metorial/db';
import {
  accessTagService,
  consumerSkillManageAccessRoles,
  consumerSkillWriteRoles,
  createResourceAuthorization,
  isLegacyResourceAuthorizationEnabled,
  revokeMigratedResourceAccessPolicies
} from '@metorial/module-access';
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
  private async getConsumerActor(d: {
    instance: Pick<Instance, 'id' | 'oid' | 'resourceTenantOid' | 'resourceGroupOid'>;
    consumerProfile: Pick<ConsumerProfile, 'oid' | 'instanceOid'>;
  }) {
    let scope = await resolveResourceScopeForOwner({
      type: 'instance',
      instance: d.instance
    });
    let actor = await resourceActorService.ensureConsumerProfileActor({
      resourceTenant: scope.resourceTenant,
      consumerProfile: d.consumerProfile
    });

    return { scope, actor };
  }

  private async getConsumerWriteAccessTags(
    consumerProfile: Pick<
      ConsumerProfile,
      'oid' | 'accessTagOid' | 'personalConsumerGroupOid' | 'surfaceOid' | 'ssoGroupIds'
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

    return Array.from(
      new Set([
        consumerProfile.accessTagOid,
        ...effectiveGroups.map(group => group.accessTagOid)
      ])
    );
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
        OR: [
          // Creator evidence remains a compatibility path until actor/access
          // reconciliation has materialized every canonical ownership grant.
          ...(isLegacyResourceAuthorizationEnabled()
            ? [{ createdByConsumerOid: d.consumerProfile.consumerOid }]
            : []),
          { createdByConsumerProfileOid: d.consumerProfile.oid },
          { accessTagEntities: accessTagFilter }
        ]
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
    consumerSurface: ConsumerSurface;
    consumerProfile: Pick<ConsumerProfile, 'accessTagOid' | 'personalConsumerGroupOid'>;
    skill: Skill;
    permission: Exclude<SkillSharePermission, 'none'>;
    grantManageAccess?: boolean;
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
    if (d.grantManageAccess) {
      await consumerAccessPolicyService.grantAccess({
        organization: d.organization,
        permission: 'skill_manage_access',
        subject: {
          consumerProfile: d.consumerProfile
        },
        resource: {
          skill: d.skill
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
      (isLegacyResourceAuthorizationEnabled() &&
        d.skill.createdByConsumerOid === d.consumerProfile.consumerOid) ||
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
    skill: SkillRecord;
    permission: SkillSharePermission;
  }) {
    await this.assertCanSetConsumerSharePermission({
      instance: d.instance,
      skill: d.skill,
      consumerProfile: d.consumerProfile,
      permission: d.permission
    });
    let migratedConsumerSkills = await db.consumerSkill.findMany({
      where: {
        consumerProfileOid: d.consumerProfile.oid,
        skillOid: d.skill.oid
      },
      select: { id: true }
    });
    for (let consumerSkill of migratedConsumerSkills) {
      await revokeMigratedResourceAccessPolicies({
        sourceType: 'consumer_skill',
        sourceId: consumerSkill.id
      });
    }

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
    instance: Pick<Instance, 'id' | 'oid' | 'resourceTenantOid' | 'resourceGroupOid'>;
    skill: SkillRecord;
    consumerProfile: Pick<ConsumerProfile, 'oid' | 'instanceOid'>;
    permission: SkillSharePermission;
  }) {
    let [scope, { actor }] = await Promise.all([
      resolveResourceScopeForOwner({
        type: 'instance',
        instance: d.instance
      }),
      this.getConsumerActor({
        instance: d.instance,
        consumerProfile: d.consumerProfile
      })
    ]);

    await skillService.upsertSkillActor({
      ...scope,
      skill: d.skill,
      actor,
      permissions: getContentPermissionsForShare(d.permission),
      overridePermissions: true
    });
  }

  async reconcileSkillShareParticipants(d: { instance: Instance; skill: SkillRecord }) {
    let scope = await resolveResourceScopeForOwner({
      type: 'instance',
      instance: d.instance
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
    let permissionByProfileOid = new Map<
      bigint,
      {
        profile: ConsumerProfile;
        permission: Exclude<SkillSharePermission, 'none'>;
      }
    >();

    for (let access of consumerAccesses) {
      let profile = access.consumerGroup.personalOwner;
      if (!profile) continue;

      let permission: Exclude<SkillSharePermission, 'none'> = writeAccessTagOids.has(
        access.consumerGroup.accessTagOid.toString()
      )
        ? 'write'
        : 'read';
      let existing = permissionByProfileOid.get(profile.oid);
      if (existing?.permission != 'write') {
        permissionByProfileOid.set(profile.oid, { profile, permission });
      }
    }

    let consumerStoreParticipants = await db.storeParticipant.findMany({
      where: {
        storeOid: d.skill.storeOid!,
        resourceActor: {
          OR: [{ consumerProfileOid: { not: null } }, { consumerOid: { not: null } }]
        }
      },
      include: {
        resourceActor: true
      }
    });
    let participantByProfileOid = new Map(
      consumerStoreParticipants
        .filter(participant => participant.resourceActor.consumerProfileOid != null)
        .map(participant => [participant.resourceActor.consumerProfileOid!, participant])
    );

    for (let [profileOid, { profile, permission }] of permissionByProfileOid) {
      let permissions = getContentPermissionsForShare(permission);
      let existing = participantByProfileOid.get(profileOid);
      participantByProfileOid.delete(profileOid);
      if (
        existing &&
        existing.permissions.length == permissions.length &&
        permissions.every(item => existing.permissions.includes(item))
      ) {
        continue;
      }
      let actor =
        existing?.resourceActor ??
        (await resourceActorService.ensureConsumerProfileActor({
          resourceTenant: scope.resourceTenant,
          consumerProfile: profile
        }));

      await skillService.upsertSkillActor({
        ...scope,
        skill: d.skill,
        actor,
        permissions,
        overridePermissions: true
      });
      if (existing) {
        await revokeMigratedResourceAccessPolicies({
          sourceType: 'store_participant',
          sourceId: existing.id
        });
      }
    }

    let activeProfileParticipantOids = new Set(
      Array.from(participantByProfileOid.values(), participant => participant.oid)
    );
    for (let participant of consumerStoreParticipants) {
      if (
        participant.resourceActor.consumerProfileOid != null &&
        !activeProfileParticipantOids.has(participant.oid)
      ) {
        continue;
      }
      if (participant.permissions.length == 0) continue;
      await skillService.upsertSkillActor({
        ...scope,
        skill: d.skill,
        actor: participant.resourceActor,
        permissions: [],
        overridePermissions: true
      });
      await revokeMigratedResourceAccessPolicies({
        sourceType: 'store_participant',
        sourceId: participant.id
      });
    }
  }

  private async setOrganizationMemberSkillSharePermission(d: {
    instance: Instance;
    skill: SkillRecord;
    member: OrganizationMember & { actor: OrganizationActor };
    permission: SkillSharePermission;
  }) {
    await this.assertCanSetOrganizationActorSharePermission({
      instance: d.instance,
      skill: d.skill,
      organizationActor: d.member.actor,
      permission: d.permission
    });

    let scope = await resolveResourceScopeForOwner({
      type: 'instance',
      instance: d.instance
    });
    let actor = await resourceActorService.ensureOrganizationActor({
      resourceTenant: scope.resourceTenant,
      organizationActorOid: d.member.actor.oid
    });
    await skillService.upsertSkillActor({
      ...scope,
      skill: d.skill,
      actor,
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
    let actor = await resourceActorService.ensureConsumerProfileActor({
      resourceTenant: scope.resourceTenant,
      consumerProfile: d.consumerProfile
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
        authorization: createResourceAuthorization({
          restricted: true,
          resourceActor: actor,
          accessTags: [
            { accessTagOid: d.consumerProfile.accessTagOid },
            ...d.consumerGroups.map(group => ({
              accessTagOid: group.accessTagOid
            }))
          ],
          ...scope,
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
      consumerSurface: d.consumerSurface,
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

    let scope = await resolveResourceScopeForOwner({
      type: 'instance',
      instance: d.instance
    });
    let actor = await resourceActorService.ensureConsumerProfileActor({
      resourceTenant: scope.resourceTenant,
      consumerProfile: d.consumerProfile
    });
    let parentSkill = await skillService.getSkillById({
      ...scope,
      skillId: d.parentSkillId,
      accessTags: [
        d.consumerProfile.accessTagOid,
        ...d.consumerGroups.map(group => group.accessTagOid)
      ],
      consumerProfileOid: d.consumerProfile.oid
    });
    let localSkill = await skillService.createSkill({
      ...scope,
      parentSkill,
      parentSkillCloneType: 'fork',
      input: {
        id: await ID.generateId('skill'),
        authorization: createResourceAuthorization({
          restricted: true,
          resourceActor: actor,
          accessTags: [
            { accessTagOid: d.consumerProfile.accessTagOid },
            ...d.consumerGroups.map(group => ({
              accessTagOid: group.accessTagOid
            }))
          ],
          ...scope,
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
      consumerSurface: d.consumerSurface,
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
    currentOrganizationMember?: OrganizationMember;
    targets: {
      consumerProfileIds?: string[];
      organizationMemberIds?: string[];
    };
  }) {
    return await withTransaction(async () => {
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

        await this.assertConsumerCanManageSkillAccess({
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

        for (let member of members as Array<
          OrganizationMember & { actor: OrganizationActor }
        >) {
          await this.setOrganizationMemberSkillSharePermission({
            instance: d.instance,
            skill: d.skill,
            member,
            permission: d.permission
          });
        }
      }
    });
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
