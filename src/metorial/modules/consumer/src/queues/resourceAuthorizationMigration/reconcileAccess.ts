import { db, ID, type Organization, withTransaction } from '@metorial/db';
import { resourceActorService } from '@metorial/module-resource-tenant';
import { consumerAccessPolicyService } from '../../services/consumerAccess/accessPolicy';
import { recordMigrationArtifact } from './artifacts';
import {
  getConsumerSkillPermissions,
  getPersonalConsumerAccessPermissions,
  getSkillParticipantPolicyIdentifier,
  shouldPruneMigrationPolicy
} from './rules';

let ensureSkillParticipant = async (d: {
  skillOid: bigint;
  resourceActorOid: bigint;
  roles?: ('creator' | 'editor' | 'viewer' | 'user' | 'forker')[];
}) => {
  let existing = await db.skillParticipant.findUnique({
    where: {
      skillOid_resourceActorOid: {
        skillOid: d.skillOid,
        resourceActorOid: d.resourceActorOid
      }
    }
  });
  let roles = [...new Set([...(existing?.roles ?? []), ...(d.roles ?? [])])];
  return await db.skillParticipant.upsert({
    where: {
      skillOid_resourceActorOid: {
        skillOid: d.skillOid,
        resourceActorOid: d.resourceActorOid
      }
    },
    create: {
      id: await ID.generateId('skillParticipant'),
      skillOid: d.skillOid,
      resourceActorOid: d.resourceActorOid,
      roles
    },
    // Participant rows are durable attribution. Existing role evidence is not
    // downgraded by this migration.
    update: { roles }
  });
};

let grantSkillPermissions = async (d: {
  runId: string;
  organization: Organization;
  profile: { personalConsumerGroupOid: bigint };
  skill: { oid: bigint };
  skillParticipantId: string;
  permissions: ('skill_read' | 'skill_write' | 'skill_manage_access')[];
}) => {
  for (let permission of d.permissions) {
    await consumerAccessPolicyService.grantAccess({
      organization: d.organization,
      permission,
      subject: { personalConsumerGroupForProfile: d.profile },
      resource: { skill: d.skill },
      policyScope: {
        type: 'skill_participant_migration',
        runId: d.runId,
        skillParticipantId: d.skillParticipantId
      }
    });
  }
};

export let reconcileCanonicalAccess = async (d: {
  runId: string;
  fence: () => Promise<void>;
}) => {
  let grants = 0;
  let unresolved = 0;
  let prunedPolicies = 0;
  let unresolvedKeys: string[] = [];
  let validConsumerAccessIds = new Set<string>();
  let expectedMigrationPolicyIdentifiers = new Set<string>();
  let priorPersonalAccessConversions =
    await db.resourceAuthorizationMigrationArtifact.findMany({
      where: {
        runId: d.runId,
        stage: 'access_reconciliation',
        kind: 'revocation_audit',
        recordKey: {
          startsWith: 'personal_consumer_access:'
        }
      },
      select: {
        payload: true
      }
    });
  for (let conversion of priorPersonalAccessConversions) {
    let payload = conversion.payload as {
      skillParticipantId?: string;
      permissions?: ('skill_read' | 'skill_write' | 'skill_manage_access')[];
    };
    if (!payload.skillParticipantId) continue;
    for (let permission of payload.permissions ?? []) {
      expectedMigrationPolicyIdentifiers.add(
        getSkillParticipantPolicyIdentifier(d.runId, payload.skillParticipantId, permission)
      );
    }
  }

  let accesses = await db.consumerAccess.findMany({
    where: {
      surface: { status: 'active' },
      consumerGroup: { status: 'active' }
    },
    include: {
      surface: { include: { organization: true } },
      consumerGroup: true,
      providerTemplate: true,
      magicMcpServer: true,
      skill: {
        include: {
          resourceTenant: true
        }
      },
      skillTemplate: true,
      skillGroup: true,
      skillMarketplace: true
    }
  });
  for (let access of accesses) {
    await d.fence();
    let targetCount = [
      access.providerTemplate,
      access.magicMcpServer,
      access.skill,
      access.skillTemplate,
      access.skillGroup,
      access.skillMarketplace
    ].filter(Boolean).length;
    if (
      targetCount == 1 &&
      ((access.type == 'provider_template' && access.providerTemplate) ||
        (access.type == 'magic_mcp_server' && access.magicMcpServer))
    ) {
      validConsumerAccessIds.add(access.id);
      continue;
    }
    let resource = access.skill
      ? { skill: access.skill }
      : access.skillTemplate
        ? { skillTemplate: access.skillTemplate }
        : access.skillGroup
          ? { skillGroup: access.skillGroup }
          : access.skillMarketplace
            ? { skillMarketplace: access.skillMarketplace }
            : null;
    let targetInstanceOid =
      access.skill?.instanceOid ??
      access.skillTemplate?.instanceOid ??
      access.skillGroup?.instanceOid ??
      access.skillMarketplace?.instanceOid;
    let targetActive =
      access.skill?.status == 'active' ||
      access.skillTemplate?.status == 'active' ||
      access.skillGroup?.status == 'active' ||
      access.skillMarketplace?.status == 'active';
    let targetMatchesType =
      (access.type == 'skill' && !!access.skill) ||
      (access.type == 'skill_template' && !!access.skillTemplate) ||
      (access.type == 'skill_group' && !!access.skillGroup) ||
      (access.type == 'skill_marketplace' && !!access.skillMarketplace);
    if (
      !resource ||
      targetCount != 1 ||
      !targetMatchesType ||
      access.consumerGroup.surfaceOid != access.surfaceOid ||
      targetInstanceOid != access.surface.instanceOid ||
      !targetActive
    ) {
      unresolved++;
      let recordKey = `consumer_access:${access.oid}`;
      unresolvedKeys.push(recordKey);
      await recordMigrationArtifact({
        runId: d.runId,
        stage: 'access_reconciliation',
        kind: 'data_issue',
        recordKey,
        classification: 'stale_legacy',
        payload: {
          consumerAccessOid: access.oid,
          reason: 'malformed_inactive_or_scope_mismatched_consumer_access'
        }
      });
      continue;
    }
    if (access.skill && access.consumerGroup.type == 'user_access') {
      let profile = await db.consumerProfile.findFirst({
        where: {
          personalConsumerGroupOid: access.consumerGroupOid,
          status: 'active',
          instanceOid: access.skill.instanceOid,
          surfaceOid: access.surfaceOid
        }
      });
      if (!profile || !access.skill.resourceTenant) {
        unresolved++;
        let recordKey = `personal_consumer_access:${access.oid}`;
        unresolvedKeys.push(recordKey);
        await recordMigrationArtifact({
          runId: d.runId,
          stage: 'access_reconciliation',
          kind: 'data_issue',
          recordKey,
          classification: 'unresolved',
          payload: {
            consumerAccessOid: access.oid,
            reason: 'personal_consumer_access_profile_or_resource_tenant_missing'
          }
        });
        continue;
      }
      let personalSkill = access.skill;
      let resourceTenant = personalSkill.resourceTenant!;

      let converted = await withTransaction(async tx => {
        let claimedSource = await tx.consumerAccess.deleteMany({
          where: {
            oid: access.oid
          }
        });
        if (!claimedSource.count) return false;

        let actor = await resourceActorService.ensureConsumerProfileActor({
          resourceTenant,
          consumerProfile: profile
        });
        let existingParticipant = await db.skillParticipant.findUnique({
          where: {
            skillOid_resourceActorOid: {
              skillOid: personalSkill.oid,
              resourceActorOid: actor.oid
            }
          }
        });
        let legacyPolicies = await db.accessTagPolicy.findMany({
          where: {
            organizationOid: access.surface.organizationOid,
            systemIdentifier: {
              startsWith: `consumer_access:${access.id}:`
            },
            accessTagEntities: {
              some: {
                accessTagOid: access.consumerGroup.accessTagOid,
                skillOid: personalSkill.oid
              }
            }
          },
          select: {
            systemIdentifier: true
          }
        });
        let policyPermissions = legacyPolicies
          .map(policy => policy.systemIdentifier?.split(':')[2])
          .filter(
            (permission): permission is 'skill_read' | 'skill_write' | 'skill_manage_access' =>
              permission == 'skill_read' ||
              permission == 'skill_write' ||
              permission == 'skill_manage_access'
          );
        let permissions = getPersonalConsumerAccessPermissions({
          policyPermissions,
          participantRoles: existingParticipant?.roles
        });

        let participant = await ensureSkillParticipant({
          skillOid: personalSkill.oid,
          resourceActorOid: actor.oid,
          roles: permissions.includes('skill_write') ? ['editor'] : ['viewer']
        });
        for (let permission of permissions) {
          expectedMigrationPolicyIdentifiers.add(
            getSkillParticipantPolicyIdentifier(d.runId, participant.id, permission)
          );
        }
        await grantSkillPermissions({
          runId: d.runId,
          organization: access.surface.organization,
          profile,
          skill: personalSkill,
          skillParticipantId: participant.id,
          permissions
        });
        grants += permissions.length;

        for (let permission of ['skill_read', 'skill_write', 'skill_manage_access'] as const) {
          await consumerAccessPolicyService.revokeAccess({
            organization: access.surface.organization,
            permission,
            subject: { consumerGroup: access.consumerGroup },
            resource: { skill: personalSkill },
            policyScope: {
              type: 'consumer_access',
              consumerAccessId: access.id
            }
          });
        }
        await recordMigrationArtifact({
          runId: d.runId,
          stage: 'access_reconciliation',
          kind: 'revocation_audit',
          recordKey: `personal_consumer_access:${access.oid}`,
          classification: 'preserved',
          payload: {
            consumerAccessOid: access.oid,
            skillParticipantId: participant.id,
            permissions,
            result: 'converted_to_participant_scoped_personal_access'
          }
        });
        return true;
      });
      if (!converted) continue;
      continue;
    }
    validConsumerAccessIds.add(access.id);
    await consumerAccessPolicyService.grantAccess({
      organization: access.surface.organization,
      permission: 'skill_read',
      subject: { consumerGroup: access.consumerGroup },
      resource,
      policyScope: {
        type: 'consumer_access',
        consumerAccessId: access.id
      }
    });
    grants++;
  }

  let consumerSkills = await db.consumerSkill.findMany({
    include: {
      organization: true,
      consumerProfile: true,
      skill: {
        include: {
          resourceTenant: true
        }
      }
    }
  });
  for (let consumerSkill of consumerSkills) {
    await d.fence();
    if (
      consumerSkill.consumerProfile.status != 'active' ||
      consumerSkill.skill.status != 'active' ||
      !consumerSkill.skill.resourceTenant ||
      consumerSkill.consumerProfile.instanceOid != consumerSkill.instanceOid ||
      consumerSkill.consumerProfile.surfaceOid != consumerSkill.surfaceOid ||
      consumerSkill.skill.instanceOid != consumerSkill.instanceOid ||
      consumerSkill.skill.organizationOid != consumerSkill.organizationOid
    ) {
      unresolved++;
      let recordKey = `consumer_skill:${consumerSkill.oid}`;
      unresolvedKeys.push(recordKey);
      await recordMigrationArtifact({
        runId: d.runId,
        stage: 'access_reconciliation',
        kind: 'data_issue',
        recordKey,
        classification: 'stale_legacy',
        payload: {
          consumerSkillOid: consumerSkill.oid,
          reason: 'consumer_skill_scope_mismatch'
        }
      });
      continue;
    }
    let actor = await resourceActorService.ensureConsumerProfileActor({
      resourceTenant: consumerSkill.skill.resourceTenant,
      consumerProfile: consumerSkill.consumerProfile
    });
    let participant = await ensureSkillParticipant({
      skillOid: consumerSkill.skillOid,
      resourceActorOid: actor.oid,
      roles: consumerSkill.permissions.includes('write')
        ? ['editor']
        : consumerSkill.permissions.includes('read')
          ? ['viewer']
          : []
    });
    if (consumerSkill.permissions.length == 0) continue;
    let permissions = getConsumerSkillPermissions(consumerSkill.permissions);
    for (let permission of permissions) {
      expectedMigrationPolicyIdentifiers.add(
        getSkillParticipantPolicyIdentifier(d.runId, participant.id, permission)
      );
    }
    await grantSkillPermissions({
      runId: d.runId,
      organization: consumerSkill.organization,
      profile: consumerSkill.consumerProfile,
      skill: consumerSkill.skill,
      skillParticipantId: participant.id,
      permissions
    });
    grants += permissions.length;
  }

  let creatorSkills = await db.skill.findMany({
    where: {
      OR: [
        { createdByConsumerOid: { not: null } },
        { createdByConsumerProfileOid: { not: null } },
        { createdByResourceActor: { consumerProfileOid: { not: null } } }
      ]
    },
    include: {
      organization: true,
      resourceTenant: true,
      createdByConsumerProfile: true,
      createdByResourceActor: {
        include: { consumerProfile: true }
      }
    }
  });
  for (let skill of creatorSkills) {
    await d.fence();
    let profile =
      skill.createdByConsumerProfile ?? skill.createdByResourceActor?.consumerProfile;
    if (!profile && skill.createdByConsumerOid) {
      let ownerLinks = await db.consumerSkill.findMany({
        where: {
          skillOid: skill.oid,
          consumerOid: skill.createdByConsumerOid,
          source: 'owner',
          consumerProfile: {
            status: 'active',
            instanceOid: skill.instanceOid,
            organizationOid: skill.organizationOid
          }
        },
        include: { consumerProfile: true }
      });
      let profileCandidates =
        ownerLinks.length == 1
          ? [ownerLinks[0]!.consumerProfile]
          : await db.consumerProfile.findMany({
              where: {
                consumerOid: skill.createdByConsumerOid,
                instanceOid: skill.instanceOid,
                organizationOid: skill.organizationOid,
                status: 'active'
              }
            });
      if (profileCandidates.length == 1) {
        profile = profileCandidates[0];
      }
    }
    if (
      !profile ||
      profile.status != 'active' ||
      !skill.resourceTenant ||
      profile.instanceOid != skill.instanceOid ||
      profile.organizationOid != skill.organizationOid
    ) {
      unresolved++;
      let recordKey = `creator_skill:${skill.oid}`;
      unresolvedKeys.push(recordKey);
      await recordMigrationArtifact({
        runId: d.runId,
        stage: 'access_reconciliation',
        kind: 'data_issue',
        recordKey,
        classification: 'stale_legacy',
        payload: {
          skillOid: skill.oid,
          reason: 'invalid_creator_profile_scope_or_status'
        }
      });
      continue;
    }
    let actor = await resourceActorService.ensureConsumerProfileActor({
      resourceTenant: skill.resourceTenant,
      consumerProfile: profile
    });
    if (skill.createdByResourceActorOid != actor.oid) {
      await db.skill.update({
        where: { oid: skill.oid },
        data: { createdByResourceActorOid: actor.oid }
      });
    }
    let participant = await ensureSkillParticipant({
      skillOid: skill.oid,
      resourceActorOid: actor.oid,
      roles: ['creator', 'editor']
    });
    for (let permission of ['skill_read', 'skill_write', 'skill_manage_access'] as const) {
      expectedMigrationPolicyIdentifiers.add(
        getSkillParticipantPolicyIdentifier(d.runId, participant.id, permission)
      );
    }
    await grantSkillPermissions({
      runId: d.runId,
      organization: skill.organization,
      profile,
      skill,
      skillParticipantId: participant.id,
      permissions: ['skill_read', 'skill_write', 'skill_manage_access']
    });
    grants += 3;
  }

  let storeParticipants = await db.storeParticipant.findMany({
    where: { resourceActor: { consumerProfileOid: { not: null } } },
    include: {
      resourceActor: { include: { consumerProfile: true } },
      store: {
        include: {
          skill: { include: { organization: true } }
        }
      }
    }
  });
  for (let participant of storeParticipants) {
    await d.fence();
    let profile = participant.resourceActor.consumerProfile;
    let skill = participant.store.skill;
    if (
      !profile ||
      !skill ||
      profile.status != 'active' ||
      skill.status != 'active' ||
      profile.instanceOid != skill.instanceOid ||
      participant.store.resourceGroupOid != skill.resourceGroupOid
    ) {
      unresolved++;
      unresolvedKeys.push(`store_participant:${participant.oid}`);
      await recordMigrationArtifact({
        runId: d.runId,
        stage: 'access_reconciliation',
        kind: 'data_issue',
        recordKey: `store_participant:${participant.oid}`,
        classification: 'unresolved',
        payload: {
          storeParticipantOid: participant.oid,
          storeOid: participant.storeOid,
          reason: 'store_has_no_owning_skill'
        }
      });
      continue;
    }
    await ensureSkillParticipant({
      skillOid: skill.oid,
      resourceActorOid: participant.resourceActorOid,
      roles: participant.permissions.includes('content_write')
        ? ['editor']
        : participant.permissions.includes('content_read')
          ? ['viewer']
          : []
    });
  }

  // Organization actors remain privileged. Their participant rows preserve
  // attribution only and intentionally never receive consumer access tags.
  let organizationActorCreators = await db.skill.findMany({
    where: { createdByResourceActor: { organizationActorOid: { not: null } } },
    select: { oid: true, createdByResourceActorOid: true }
  });
  for (let skill of organizationActorCreators) {
    await d.fence();
    await ensureSkillParticipant({
      skillOid: skill.oid,
      resourceActorOid: skill.createdByResourceActorOid!,
      roles: ['creator', 'editor']
    });
  }
  let organizationActorStoreParticipants = await db.storeParticipant.findMany({
    where: {
      resourceActor: { organizationActorOid: { not: null } },
      store: { skill: { isNot: null } }
    },
    select: {
      resourceActorOid: true,
      store: { select: { skill: { select: { oid: true } } } }
    }
  });
  for (let participant of organizationActorStoreParticipants) {
    await d.fence();
    await ensureSkillParticipant({
      skillOid: participant.store.skill!.oid,
      resourceActorOid: participant.resourceActorOid,
      roles: ['editor']
    });
  }

  await d.fence();
  await db.resourceAuthorizationMigrationArtifact.deleteMany({
    where: {
      runId: d.runId,
      stage: 'access_reconciliation',
      kind: 'data_issue',
      ...(unresolvedKeys.length ? { recordKey: { notIn: unresolvedKeys } } : {})
    }
  });

  // Converge only policies owned by this migration. Each legacy source has its
  // own policy, so pruning a removed/downgraded source cannot revoke a creator
  // grant or a different share.
  let migrationPolicies = await db.accessTagPolicy.findMany({
    where: {
      OR: [
        { systemIdentifier: { startsWith: 'consumer_access:' } },
        {
          systemIdentifier: {
            startsWith: `skill_participant_migration:${d.runId}:`
          }
        }
      ]
    }
  });
  for (let policy of migrationPolicies) {
    await d.fence();
    if (
      shouldPruneMigrationPolicy({
        systemIdentifier: policy.systemIdentifier,
        runId: d.runId,
        expectedPolicyIdentifiers: expectedMigrationPolicyIdentifiers,
        validConsumerAccessIds
      })
    ) {
      await db.accessTagPolicy.delete({ where: { oid: policy.oid } });
      prunedPolicies++;
      await recordMigrationArtifact({
        runId: d.runId,
        stage: 'access_reconciliation',
        kind: 'revocation_audit',
        recordKey: `policy:${policy.oid}`,
        classification: 'preserved',
        payload: {
          policyOid: policy.oid,
          systemIdentifier: policy.systemIdentifier,
          result: 'stale_source_specific_policy_pruned'
        }
      });
    }
  }

  return { grants, unresolved, prunedPolicies };
};

export let normalizeMigrationParticipantPolicies = async (d: { runId: string }) => {
  return await withTransaction(async db => {
    let policies = await db.accessTagPolicy.findMany({
      where: {
        systemIdentifier: {
          startsWith: `skill_participant_migration:${d.runId}:`
        }
      },
      include: {
        accessTagEntities: true
      }
    });

    for (let policy of policies) {
      let parts = policy.systemIdentifier!.split(':');
      let participantId = parts[2];
      let permission = parts[3];
      if (!participantId || !permission) {
        throw new Error(`Invalid migration participant policy ${policy.systemIdentifier}.`);
      }
      let systemIdentifier = `skill_participant:${participantId}:${permission}`;
      let existing = await db.accessTagPolicy.findUnique({
        where: {
          organizationOid_systemIdentifier: {
            organizationOid: policy.organizationOid,
            systemIdentifier
          }
        }
      });

      if (!existing) {
        await db.accessTagPolicy.update({
          where: { oid: policy.oid },
          data: {
            name: policy.name.replace(' migration ', ' '),
            systemIdentifier
          }
        });
        continue;
      }

      for (let entity of policy.accessTagEntities) {
        let duplicate = await db.accessTagEntity.findFirst({
          where: {
            accessTagOid: entity.accessTagOid,
            accessTagPolicyOid: existing.oid,
            skillOid: entity.skillOid
          }
        });
        if (duplicate) {
          await db.accessTagEntity.delete({ where: { oid: entity.oid } });
        } else {
          await db.accessTagEntity.update({
            where: { oid: entity.oid },
            data: { accessTagPolicyOid: existing.oid }
          });
        }
      }
      await db.accessTagPolicy.delete({ where: { oid: policy.oid } });
    }

    let conversions = await db.resourceAuthorizationMigrationArtifact.findMany({
      where: {
        runId: d.runId,
        stage: 'access_reconciliation',
        kind: 'revocation_audit',
        recordKey: {
          startsWith: 'personal_consumer_access:'
        }
      },
      select: {
        payload: true
      }
    });
    let convertedConsumerAccessOids = conversions
      .map(
        conversion => (conversion.payload as { consumerAccessOid?: string }).consumerAccessOid
      )
      .filter((oid): oid is string => !!oid)
      .map(BigInt);
    let retiredConsumerAccesses = convertedConsumerAccessOids.length
      ? await db.consumerAccess.deleteMany({
          where: {
            oid: {
              in: convertedConsumerAccessOids
            }
          }
        })
      : { count: 0 };

    return {
      normalizedPolicies: policies.length,
      retiredConsumerAccesses: retiredConsumerAccesses.count
    };
  });
};
