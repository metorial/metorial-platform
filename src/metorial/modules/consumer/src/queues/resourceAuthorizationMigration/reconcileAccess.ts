import { db } from '@metorial/db';
import { consumerAccessPolicyService } from '../../services/consumerAccess/accessPolicy';
import { recordMigrationArtifact } from './artifacts';

let grantSkillPermissions = async (d: {
  organization: { oid: bigint };
  profile: { accessTagOid: bigint };
  skill: { oid: bigint };
  permissions: ('skill_read' | 'skill_write' | 'skill_manage_access')[];
  sourceId?: string;
}) => {
  for (let permission of d.permissions) {
    await consumerAccessPolicyService.grantAccess({
      organization: d.organization as never,
      permission,
      subject: { consumerProfile: d.profile },
      resource: { skill: d.skill },
      policyScope: d.sourceId
        ? { type: 'consumer_access', consumerAccessId: d.sourceId }
        : undefined
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
      skill: true,
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
      skill: true
    }
  });
  let expectedMigrationPolicyIdentifiers = new Set<string>();
  for (let consumerSkill of consumerSkills) {
    await d.fence();
    if (consumerSkill.permissions.length == 0) continue;
    if (
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
    let permissions: ('skill_read' | 'skill_write' | 'skill_manage_access')[] = [];
    if (consumerSkill.permissions.includes('read')) permissions.push('skill_read');
    if (consumerSkill.permissions.includes('write')) {
      // Grandfather the current ability of an editable ConsumerSkill to reshare.
      permissions.push('skill_read', 'skill_write', 'skill_manage_access');
    }
    permissions = [...new Set(permissions)];
    for (let permission of permissions) {
      expectedMigrationPolicyIdentifiers.add(
        `consumer_access:legacy-consumer-skill:${consumerSkill.id}:${permission}`
      );
    }
    await grantSkillPermissions({
      organization: consumerSkill.organization,
      profile: consumerSkill.consumerProfile,
      skill: consumerSkill.skill,
      permissions,
      sourceId: `legacy-consumer-skill:${consumerSkill.id}`
    });
    grants += permissions.length;
  }

  let creatorSkills = await db.skill.findMany({
    where: {
      OR: [
        { createdByConsumerProfileOid: { not: null } },
        { createdByResourceActor: { consumerProfileOid: { not: null } } }
      ]
    },
    include: {
      organization: true,
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
    if (
      !profile ||
      profile.status != 'active' ||
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
    await grantSkillPermissions({
      organization: skill.organization,
      profile,
      skill,
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
    if (participant.permissions.length == 0) continue;
    let permissions: ('skill_read' | 'skill_write')[] = [];
    if (participant.permissions.includes('content_read')) permissions.push('skill_read');
    if (participant.permissions.includes('content_write')) {
      permissions.push('skill_read', 'skill_write');
    }
    permissions = [...new Set(permissions)];
    for (let permission of permissions) {
      expectedMigrationPolicyIdentifiers.add(
        `consumer_access:legacy-store-participant:${participant.id}:${permission}`
      );
    }
    await grantSkillPermissions({
      organization: skill.organization,
      profile,
      skill,
      permissions,
      sourceId: `legacy-store-participant:${participant.id}`
    });
    grants += permissions.length;
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
      systemIdentifier: { startsWith: 'consumer_access:' }
    }
  });
  for (let policy of migrationPolicies) {
    await d.fence();
    let isMigrationOwned =
      policy.systemIdentifier?.startsWith('consumer_access:legacy-consumer-skill:') ||
      policy.systemIdentifier?.startsWith('consumer_access:legacy-store-participant:');
    let sourceId = policy.systemIdentifier?.split(':')[1];
    let isOrphanConsumerAccess =
      !isMigrationOwned && !!sourceId && !validConsumerAccessIds.has(sourceId);
    if (
      policy.systemIdentifier &&
      ((isMigrationOwned &&
        !expectedMigrationPolicyIdentifiers.has(policy.systemIdentifier)) ||
        isOrphanConsumerAccess)
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
