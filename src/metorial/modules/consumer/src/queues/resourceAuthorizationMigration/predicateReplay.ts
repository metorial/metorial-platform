import { db } from '@metorial/db';
import { createHash } from 'node:crypto';
import {
  getConsumerSkillAccessWhere,
  getSkillMarketplaceAccessWhere,
  skillGroupService,
  skillService,
  skillTemplateService
} from '@metorial/cargo-module-skill';
import {
  storeAccessService,
  storeReadPermission,
  storeWritePermission
} from '@metorial/cargo-module-store';
import { createResourceAuthorization } from '@metorial/module-access';
import { replaceMigrationArtifacts } from './artifacts';
import { consumerSkillService } from '../../services/consumerEntities/consumerSkill';

type EffectiveAccessPayload = {
  profileOid: string;
  instanceOid: string;
  surfaceOid: string;
  resourceGroupOid: string | null;
  resourceType: string;
  resourceOid: string;
  action: string;
};

let SAMPLE_PER_KIND = 5;

let sampleRows = <T extends { recordKey: string; payload: unknown }>(rows: T[]) => {
  let countByKind = new Map<string, number>();
  return rows
    .sort((left, right) =>
      createHash('sha256')
        .update(left.recordKey)
        .digest('hex')
        .localeCompare(createHash('sha256').update(right.recordKey).digest('hex'))
    )
    .filter(row => {
      let payload = row.payload as EffectiveAccessPayload;
      let kind = `${payload.resourceType}:${payload.action}`;
      let count = countByKind.get(kind) ?? 0;
      if (count >= SAMPLE_PER_KIND) return false;
      countByKind.set(kind, count + 1);
      return true;
    });
};

let getReplayContext = async (
  payload: EffectiveAccessPayload,
  accessTagsOverride?: bigint[]
) => {
  let profile = await db.consumerProfile.findUnique({
    where: { oid: BigInt(payload.profileOid) }
  });
  if (!profile) return null;
  let instance = await db.instance.findUnique({
    where: { oid: BigInt(payload.instanceOid) },
    include: { resourceTenant: true, resourceGroup: true }
  });
  if (!instance?.resourceTenant || !instance.resourceGroup) return null;
  let actor = await db.resourceActor.findUnique({
    where: {
      resourceTenantOid_consumerProfileOid: {
        resourceTenantOid: instance.resourceTenant.oid,
        consumerProfileOid: profile.oid
      }
    }
  });
  if (!actor) return null;
  let groups = await db.consumerGroup.findMany({
    where: {
      surfaceOid: profile.surfaceOid,
      status: 'active',
      OR: [
        { oid: profile.personalConsumerGroupOid },
        { profiles: { some: { profileOid: profile.oid } } },
        { isDefault: true },
        ...(profile.ssoGroupIds.length
          ? [{ ssoGroupIds: { hasSome: profile.ssoGroupIds } }]
          : [])
      ]
    },
    select: { accessTagOid: true }
  });
  let accessTags = accessTagsOverride ?? groups.map(group => group.accessTagOid);
  let authorization = createResourceAuthorization({
    restricted: true,
    resourceActor: actor,
    accessTags,
    resourceTenant: instance.resourceTenant,
    resourceGroup: instance.resourceGroup,
    instance,
    consumerProfile: profile
  });
  return {
    profile,
    instance,
    resourceTenant: instance.resourceTenant,
    resourceGroup: instance.resourceGroup,
    accessTags,
    authorization
  };
};

let replayRow = async (
  payload: EffectiveAccessPayload,
  options?: { participantOnly: boolean }
) => {
  let context = await getReplayContext(payload, options?.participantOnly ? [] : undefined);
  if (!context) return { allowed: false, coverage: 'missing_context' };

  if (payload.resourceType == 'skill') {
    let skill = await db.skill.findUnique({ where: { oid: BigInt(payload.resourceOid) } });
    if (!skill) return { allowed: false, coverage: 'skill' };
    if (payload.action == 'read') {
      let accessWhere = await getConsumerSkillAccessWhere({
        accessTags: context.accessTags
      });
      let allowed = !!(await db.skill.findFirst({
        where: {
          oid: skill.oid,
          instanceOid: context.instance.oid,
          status: 'active',
          AND: accessWhere ? [accessWhere] : []
        },
        select: { oid: true }
      }));
      return { allowed, coverage: 'skill_read_filter' };
    }
    if (payload.action == 'write') {
      try {
        let record = await skillService.getSkillById({
          resourceTenant: context.resourceTenant,
          resourceGroup: context.resourceGroup,
          skillId: skill.id,
          accessTags: context.accessTags,
          allowDeleted: true
        });
        await skillService.assertSkillWriteAccess({
          resourceTenant: context.resourceTenant,
          resourceGroup: context.resourceGroup,
          skill: record,
          authorization: context.authorization
        });
        return { allowed: true, coverage: 'skill_write_service' };
      } catch {
        return { allowed: false, coverage: 'skill_write_service' };
      }
    }
    if (payload.action == 'manage_access') {
      try {
        await consumerSkillService.assertConsumerCanManageSkillAccess({
          skill,
          consumerProfile: context.profile
        });
        return { allowed: true, coverage: 'skill_manage_access_service' };
      } catch {
        return { allowed: false, coverage: 'skill_manage_access_service' };
      }
    }
  }

  if (payload.resourceType == 'skill_template' && payload.action == 'read') {
    let template = await db.skillTemplate.findUnique({
      where: { oid: BigInt(payload.resourceOid) }
    });
    if (!template) return { allowed: false, coverage: 'skill_template_service' };
    try {
      await skillTemplateService.getSkillTemplateById({
        resourceTenant: context.resourceTenant,
        resourceGroup: context.resourceGroup,
        skillTemplateId: template.id,
        accessTags: context.accessTags
      });
      return { allowed: true, coverage: 'skill_template_service' };
    } catch {
      return { allowed: false, coverage: 'skill_template_service' };
    }
  }

  if (payload.resourceType == 'skill_group' && payload.action == 'read') {
    let group = await db.skillGroup.findUnique({
      where: { oid: BigInt(payload.resourceOid) }
    });
    if (!group) return { allowed: false, coverage: 'skill_group_service' };
    try {
      await skillGroupService.getSkillGroupById({
        resourceTenant: context.resourceTenant,
        resourceGroup: context.resourceGroup,
        skillGroupId: group.id,
        accessTags: context.accessTags
      });
      return { allowed: true, coverage: 'skill_group_service' };
    } catch {
      return { allowed: false, coverage: 'skill_group_service' };
    }
  }

  if (payload.resourceType == 'skill_marketplace') {
    let accessWhere = await getSkillMarketplaceAccessWhere({
      accessTags: context.accessTags
    });
    let allowed = !!(await db.skillMarketplace.findFirst({
      where: {
        oid: BigInt(payload.resourceOid),
        instanceOid: context.instance.oid,
        status: 'active',
        AND: accessWhere ? [accessWhere] : []
      },
      select: { oid: true }
    }));
    return { allowed, coverage: 'marketplace_filter' };
  }

  if (payload.resourceType == 'skill_plugin') {
    let marketplaceWhere = await getSkillMarketplaceAccessWhere({
      accessTags: context.accessTags
    });
    let allowed = !!(await db.skillPlugin.findFirst({
      where: {
        oid: BigInt(payload.resourceOid),
        instanceOid: context.instance.oid,
        status: 'active',
        skillMarketplacePlugins: {
          some: {
            status: 'active',
            skillMarketplace: {
              status: 'active',
              AND: marketplaceWhere ? [marketplaceWhere] : []
            }
          }
        }
      },
      select: { oid: true }
    }));
    return { allowed, coverage: 'plugin_marketplace_filter' };
  }

  if (payload.resourceType.startsWith('skill_group_assignment:')) {
    let groupOid = BigInt(payload.resourceType.split(':')[1]!);
    let [group, skill] = await Promise.all([
      db.skillGroup.findUnique({ where: { oid: groupOid } }),
      db.skill.findUnique({ where: { oid: BigInt(payload.resourceOid) } })
    ]);
    if (!group || !skill) return { allowed: false, coverage: 'group_assignment' };
    try {
      let [groupRecord, skillRecord] = await Promise.all([
        skillGroupService.getSkillGroupById({
          resourceTenant: context.resourceTenant,
          resourceGroup: context.resourceGroup,
          skillGroupId: group.id,
          accessTags: context.accessTags
        }),
        skillService.getSkillById({
          resourceTenant: context.resourceTenant,
          resourceGroup: context.resourceGroup,
          skillId: skill.id,
          accessTags: context.accessTags,
          allowDeleted: true
        })
      ]);
      if (!groupRecord.allowConsumerSkillAssignment) {
        return { allowed: false, coverage: 'group_assignment_services' };
      }
      await skillService.assertSkillWriteAccess({
        resourceTenant: context.resourceTenant,
        resourceGroup: context.resourceGroup,
        skill: skillRecord,
        authorization: context.authorization
      });
      return { allowed: true, coverage: 'group_assignment_services' };
    } catch {
      return { allowed: false, coverage: 'group_assignment_services' };
    }
  }

  let requiredPermission =
    payload.action == 'write' ? storeWritePermission : storeReadPermission;
  if (payload.resourceType == 'store') {
    let store = await db.store.findUnique({ where: { oid: BigInt(payload.resourceOid) } });
    if (!store) return { allowed: false, coverage: 'store_service' };
    let permissions = await storeAccessService.getStorePermissions({
      resourceTenant: context.resourceTenant,
      resourceGroup: context.resourceGroup,
      store,
      authorization: context.authorization
    });
    return {
      allowed: permissions.permissions.includes(requiredPermission),
      coverage: 'store_service'
    };
  }
  if (payload.resourceType == 'document') {
    let document = await db.document.findUnique({
      where: { oid: BigInt(payload.resourceOid) }
    });
    if (!document) return { allowed: false, coverage: 'document_service' };
    let permissions = await storeAccessService.getDocumentPermissions({
      resourceTenant: context.resourceTenant,
      resourceGroup: context.resourceGroup,
      document,
      authorization: context.authorization
    });
    return {
      allowed: permissions.permissions.includes(requiredPermission),
      coverage: 'document_service'
    };
  }
  if (payload.resourceType == 'file') {
    let file = await db.file.findUnique({ where: { oid: BigInt(payload.resourceOid) } });
    if (!file) return { allowed: false, coverage: 'file_service' };
    try {
      await storeAccessService.assertStoreAccessForFile({
        resourceTenant: context.resourceTenant,
        resourceGroup: context.resourceGroup,
        file,
        authorization: context.authorization,
        requiredPermission
      });
      return { allowed: true, coverage: 'file_service' };
    } catch {
      return { allowed: false, coverage: 'file_service' };
    }
  }
  return { allowed: true, coverage: 'not_replayable' };
};

export let replayCanonicalAccessSample = async (d: { runId: string }) => {
  let canonicalRows = await db.resourceAuthorizationMigrationArtifact.findMany({
    where: {
      runId: d.runId,
      stage: 'canonical',
      kind: 'effective_access'
    },
    select: { recordKey: true, payload: true }
  });
  let sampled = sampleRows(canonicalRows);
  let artifacts = [];
  for (let row of sampled) {
    let payload = row.payload as unknown as EffectiveAccessPayload;
    let replay = await replayRow(payload);
    artifacts.push({
      recordKey: row.recordKey,
      classification:
        replay.coverage == 'not_replayable'
          ? 'not_replayable'
          : replay.allowed
            ? 'preserved'
            : 'mismatch',
      payload: { ...payload, ...replay, expected: true }
    });
  }
  let participantRows = await db.skillParticipant.findMany({
    where: {
      resourceActor: { consumerProfileOid: { not: null } },
      skill: { status: 'active', resourceGroupOid: { not: null } }
    },
    include: {
      resourceActor: { include: { consumerProfile: true } },
      skill: true
    }
  });
  let participantSamples = participantRows
    .sort((left, right) =>
      createHash('sha256')
        .update(left.id)
        .digest('hex')
        .localeCompare(createHash('sha256').update(right.id).digest('hex'))
    )
    .slice(0, SAMPLE_PER_KIND);
  let participantArtifacts = [];
  for (let participant of participantSamples) {
    let profile = participant.resourceActor.consumerProfile!;
    let payload: EffectiveAccessPayload = {
      profileOid: profile.oid.toString(),
      instanceOid: profile.instanceOid.toString(),
      surfaceOid: profile.surfaceOid.toString(),
      resourceGroupOid: participant.skill.resourceGroupOid!.toString(),
      resourceType: 'skill',
      resourceOid: participant.skillOid.toString(),
      action: 'read'
    };
    let replay = await replayRow(payload, { participantOnly: true });
    participantArtifacts.push({
      recordKey: `skill_participant:${participant.id}:read`,
      classification: replay.allowed ? 'mismatch' : 'preserved',
      payload: {
        ...payload,
        skillParticipantId: participant.id,
        ...replay,
        expected: false,
        accessTags: [],
        assertion: 'participant_row_alone_never_grants'
      }
    });
  }
  await replaceMigrationArtifacts({
    runId: d.runId,
    stage: 'predicate_replay',
    kind: 'sample',
    immutable: false,
    artifacts
  });
  await replaceMigrationArtifacts({
    runId: d.runId,
    stage: 'predicate_replay',
    kind: 'participant_only_sample',
    immutable: false,
    artifacts: participantArtifacts
  });
  let mismatches = [...artifacts, ...participantArtifacts].filter(
    artifact => artifact.classification == 'mismatch'
  );
  if (mismatches.length) {
    throw new Error(`Canonical predicate replay found ${mismatches.length} mismatches.`);
  }
  return {
    sampled: artifacts.length,
    replayed: artifacts.filter(artifact => artifact.classification == 'preserved').length,
    participantOnlySampled: participantArtifacts.length,
    notReplayable: artifacts.filter(artifact => artifact.classification == 'not_replayable')
      .length
  };
};
