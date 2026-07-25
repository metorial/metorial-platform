import { db, type Prisma } from '@metorial/db';
import { replaceMigrationArtifacts } from './artifacts';
import { participantEvidenceGrantsAuthorization } from './rules';

type SnapshotRow = {
  profileOid: bigint;
  instanceOid: bigint;
  surfaceOid: bigint;
  resourceGroupOid: bigint | null;
  resourceType: string;
  resourceOid: bigint;
  action: string;
  source: string;
  sourceOid: bigint;
};

type EffectiveGroup = {
  isDefault: boolean;
  ssoGroupIds: string[];
  personalOwner: {
    oid: bigint;
    instanceOid: bigint;
    surfaceOid: bigint;
    ssoGroupIds: string[];
    status: string;
  } | null;
  profiles: {
    profile: {
      oid: bigint;
      instanceOid: bigint;
      surfaceOid: bigint;
      ssoGroupIds: string[];
      status: string;
    };
  }[];
  surface: {
    consumerProfiles: {
      oid: bigint;
      instanceOid: bigint;
      surfaceOid: bigint;
      ssoGroupIds: string[];
      status: string;
    }[];
    status: string;
    type: string;
    portal: { status: string } | null;
  };
};

let getEffectiveGroupProfiles = (group: EffectiveGroup) => {
  let profiles = new Map<
    bigint,
    {
      oid: bigint;
      instanceOid: bigint;
      surfaceOid: bigint;
      ssoGroupIds: string[];
      status: string;
    }
  >();
  if (
    group.surface.type != 'portal' ||
    group.surface.status != 'active' ||
    group.surface.portal?.status != 'active'
  ) {
    return [];
  }
  if (group.personalOwner) profiles.set(group.personalOwner.oid, group.personalOwner);
  for (let membership of group.profiles) {
    profiles.set(membership.profile.oid, membership.profile);
  }
  for (let profile of group.surface.consumerProfiles) {
    if (
      group.isDefault ||
      group.ssoGroupIds.some(ssoGroupId => profile.ssoGroupIds.includes(ssoGroupId))
    ) {
      profiles.set(profile.oid, profile);
    }
  }
  return [...profiles.values()].filter(profile => profile.status == 'active');
};

let snapshotKey = (row: SnapshotRow) =>
  [
    row.profileOid,
    row.resourceType,
    row.resourceOid,
    row.action,
    row.source,
    row.sourceOid
  ].join(':');

let inventoryLegacyAccessInTransaction = async (d: {
  runId: string;
  stage: 'pre_actor' | 'post_actor' | 'canonical';
  database: Prisma.TransactionClient;
}) => {
  let database = d.database;
  let dataIssues: {
    recordKey: string;
    classification: string;
    payload: unknown;
  }[] = [];
  let [consumerSkills, skills, entities, accesses, storeParticipants, skillParticipants] =
    await Promise.all([
      database.consumerSkill.findMany({
        include: {
          consumerProfile: true,
          skill: true,
          instance: { select: { resourceGroupOid: true } }
        }
      }),
      database.skill.findMany({
        where: {
          OR: [
            { createdByConsumerProfileOid: { not: null } },
            { createdByConsumerOid: { not: null } },
            {
              createdByResourceActor: {
                OR: [{ consumerProfileOid: { not: null } }, { consumerOid: { not: null } }]
              }
            }
          ]
        },
        include: {
          createdByResourceActor: true
        }
      }),
      database.accessTagEntity.findMany({
        include: {
          skill: true,
          skillTemplate: true,
          skillGroup: true,
          skillMarketplace: true,
          accessTagPolicy: true,
          accessTag: {
            include: {
              consumerProfile: {
                include: { surface: { include: { portal: true } } }
              },
              consumerGroup: {
                include: {
                  personalOwner: true,
                  profiles: { include: { profile: true } },
                  surface: {
                    include: { consumerProfiles: true, portal: true }
                  }
                }
              }
            }
          }
        }
      }),
      database.consumerAccess.findMany({
        include: {
          skill: true,
          skillTemplate: true,
          skillGroup: true,
          skillMarketplace: true,
          consumerGroup: {
            include: {
              personalOwner: true,
              profiles: { include: { profile: true } },
              surface: {
                include: { consumerProfiles: true, portal: true }
              }
            }
          }
        }
      }),
      database.storeParticipant.findMany({
        include: {
          resourceActor: { include: { consumerProfile: true } },
          store: { include: { skill: true } }
        }
      }),
      database.skillParticipant.findMany({
        include: {
          resourceActor: { include: { consumerProfile: true } },
          skill: true
        }
      })
    ]);

  let rows: SnapshotRow[] = [];
  let add = (row: SnapshotRow) => rows.push(row);
  let addSkillActions = (base: Omit<SnapshotRow, 'action'>, actions: string[]) =>
    actions.forEach(action => add({ ...base, action }));

  for (let consumerSkill of d.stage == 'canonical' ? [] : consumerSkills) {
    if (
      consumerSkill.permissions.length == 0 ||
      consumerSkill.consumerProfile.status != 'active' ||
      consumerSkill.consumerProfile.instanceOid != consumerSkill.instanceOid ||
      consumerSkill.consumerProfile.surfaceOid != consumerSkill.surfaceOid ||
      consumerSkill.skill.instanceOid != consumerSkill.instanceOid ||
      consumerSkill.skill.organizationOid != consumerSkill.organizationOid ||
      consumerSkill.skill.status != 'active'
    ) {
      dataIssues.push({
        recordKey: `consumer_skill:${consumerSkill.oid}`,
        classification: 'stale_legacy',
        payload: {
          consumerSkillOid: consumerSkill.oid,
          reason: 'empty_inactive_or_scope_mismatched_consumer_skill'
        }
      });
      continue;
    }
    if (consumerSkill.permissions.length == 0) continue;
    if (
      consumerSkill.consumerProfile.instanceOid != consumerSkill.instanceOid ||
      consumerSkill.consumerProfile.surfaceOid != consumerSkill.surfaceOid
    ) {
      dataIssues.push({
        recordKey: `consumer_skill:${consumerSkill.oid}`,
        classification: 'stale_legacy',
        payload: {
          consumerSkillOid: consumerSkill.oid,
          reason: 'consumer_skill_scope_mismatch'
        }
      });
      continue;
    }
    let actions: string[] = [];
    if (consumerSkill.permissions.includes('read')) actions.push('read');
    if (consumerSkill.permissions.includes('write')) {
      actions.push('write', 'manage_access');
      if (!actions.includes('read')) actions.unshift('read');
    }
    addSkillActions(
      {
        profileOid: consumerSkill.consumerProfileOid,
        instanceOid: consumerSkill.instanceOid,
        surfaceOid: consumerSkill.surfaceOid,
        resourceGroupOid: consumerSkill.instance.resourceGroupOid,
        resourceType: 'skill',
        resourceOid: consumerSkill.skillOid,
        source: 'consumer_skill',
        sourceOid: consumerSkill.oid
      },
      actions
    );
  }

  for (let skill of d.stage == 'canonical' ? [] : skills) {
    let profileOids = new Set<bigint>();
    if (skill.createdByConsumerProfileOid) profileOids.add(skill.createdByConsumerProfileOid);
    if (skill.createdByResourceActor?.consumerProfileOid) {
      profileOids.add(skill.createdByResourceActor.consumerProfileOid);
    }
    if (skill.createdByConsumerOid || skill.createdByResourceActor?.consumerOid) {
      let consumerOid =
        skill.createdByConsumerOid ?? skill.createdByResourceActor?.consumerOid;
      let candidates = await database.consumerProfile.findMany({
        where: {
          consumerOid: consumerOid!,
          instanceOid: skill.instanceOid,
          status: 'active',
          surface: { type: 'portal', status: 'active', portal: { status: 'active' } }
        },
        orderBy: [{ createdAt: 'asc' }, { oid: 'asc' }]
      });
      if (candidates[0]) profileOids.add(candidates[0].oid);
    }
    for (let profileOid of profileOids) {
      let profile = await database.consumerProfile.findUnique({
        where: { oid: profileOid },
        include: { surface: { include: { portal: true } } }
      });
      if (
        !profile ||
        profile.status != 'active' ||
        profile.instanceOid != skill.instanceOid ||
        profile.organizationOid != skill.organizationOid ||
        profile.surface.type != 'portal' ||
        profile.surface.status != 'active' ||
        profile.surface.portal?.status != 'active'
      ) {
        dataIssues.push({
          recordKey: `creator:${skill.oid}:profile:${profileOid}`,
          classification: 'stale_legacy',
          payload: {
            skillOid: skill.oid,
            consumerProfileOid: profileOid,
            reason: 'invalid_creator_profile_status_or_scope'
          }
        });
        continue;
      }
      addSkillActions(
        {
          profileOid,
          instanceOid: skill.instanceOid,
          surfaceOid: profile.surfaceOid,
          resourceGroupOid: skill.resourceGroupOid,
          resourceType: 'skill',
          resourceOid: skill.oid,
          source: 'creator',
          sourceOid: skill.oid
        },
        ['read', 'write', 'manage_access']
      );
    }
  }

  for (let entity of entities) {
    let targetCount = [
      entity.magicMcpTokenOid,
      entity.magicMcpServerOid,
      entity.magicMcpEndpointOid,
      entity.providerTemplateOid,
      entity.skillOid,
      entity.skillTemplateOid,
      entity.skillGroupOid,
      entity.skillMarketplaceOid
    ].filter(value => value != null).length;
    if (targetCount != 1) {
      dataIssues.push({
        recordKey: `access_tag_entity:${entity.oid}`,
        classification: 'stale_legacy',
        payload: {
          accessTagEntityOid: entity.oid,
          reason: 'malformed_multi_or_zero_target_access_tag_entity'
        }
      });
      continue;
    }
    let resource = entity.skill
      ? {
          type: 'skill',
          oid: entity.skill.oid,
          instanceOid: entity.skill.instanceOid,
          resourceGroupOid: entity.skill.resourceGroupOid,
          active: entity.skill.status == 'active'
        }
      : entity.skillTemplate
        ? {
            type: 'skill_template',
            oid: entity.skillTemplate.oid,
            instanceOid: entity.skillTemplate.instanceOid,
            resourceGroupOid: entity.skillTemplate.resourceGroupOid,
            active: entity.skillTemplate.status == 'active'
          }
        : entity.skillGroup
          ? {
              type: 'skill_group',
              oid: entity.skillGroup.oid,
              instanceOid: entity.skillGroup.instanceOid,
              resourceGroupOid: null,
              active: entity.skillGroup.status == 'active'
            }
          : entity.skillMarketplace
            ? {
                type: 'skill_marketplace',
                oid: entity.skillMarketplace.oid,
                instanceOid: entity.skillMarketplace.instanceOid,
                resourceGroupOid: entity.skillMarketplace.resourceGroupOid,
                active: entity.skillMarketplace.status == 'active'
              }
            : null;
    if (!resource) continue;
    let profiles = entity.accessTag.consumerProfile
      ? [entity.accessTag.consumerProfile]
      : entity.accessTag.consumerGroup
        ? getEffectiveGroupProfiles(entity.accessTag.consumerGroup)
        : [];
    let directSurface = entity.accessTag.consumerProfile?.surface;
    let actions = entity.accessTagPolicy.roles.flatMap(role =>
      role.endsWith(':manage_access')
        ? ['manage_access']
        : role.endsWith(':write')
          ? ['write']
          : role.endsWith(':read')
            ? ['read']
            : []
    );
    for (let profile of profiles) {
      if (
        !resource.active ||
        profile.status != 'active' ||
        (directSurface != null &&
          (directSurface.type != 'portal' ||
            directSurface.status != 'active' ||
            directSurface.portal?.status != 'active')) ||
        profile.instanceOid != resource.instanceOid ||
        (entity.accessTag.consumerGroup != null &&
          profile.surfaceOid != entity.accessTag.consumerGroup.surfaceOid)
      ) {
        dataIssues.push({
          recordKey: `access_tag_entity:${entity.oid}:profile:${profile.oid}`,
          classification: 'stale_legacy',
          payload: {
            accessTagEntityOid: entity.oid,
            consumerProfileOid: profile.oid,
            reason: 'inactive_or_cross_instance_or_cross_surface'
          }
        });
        continue;
      }
      for (let action of actions) {
        add({
          profileOid: profile.oid,
          instanceOid: profile.instanceOid,
          surfaceOid: profile.surfaceOid,
          resourceGroupOid: resource.resourceGroupOid,
          resourceType: resource.type,
          resourceOid: resource.oid,
          action,
          source: 'access_tag_entity',
          sourceOid: entity.oid
        });
      }
    }
  }

  for (let access of d.stage == 'canonical' ? [] : accesses) {
    let targetCount = [
      access.providerTemplateOid,
      access.magicMcpServerOid,
      access.skillOid,
      access.skillTemplateOid,
      access.skillGroupOid,
      access.skillMarketplaceOid
    ].filter(value => value != null).length;
    let validNonSkillTarget =
      targetCount == 1 &&
      ((access.type == 'provider_template' && access.providerTemplateOid != null) ||
        (access.type == 'magic_mcp_server' && access.magicMcpServerOid != null));
    if (validNonSkillTarget) continue;
    let resource = access.skill
      ? {
          type: 'skill',
          oid: access.skill.oid,
          instanceOid: access.skill.instanceOid,
          resourceGroupOid: access.skill.resourceGroupOid,
          active: access.skill.status == 'active'
        }
      : access.skillTemplate
        ? {
            type: 'skill_template',
            oid: access.skillTemplate.oid,
            instanceOid: access.skillTemplate.instanceOid,
            resourceGroupOid: access.skillTemplate.resourceGroupOid,
            active: access.skillTemplate.status == 'active'
          }
        : access.skillGroup
          ? {
              type: 'skill_group',
              oid: access.skillGroup.oid,
              instanceOid: access.skillGroup.instanceOid,
              resourceGroupOid: null,
              active: access.skillGroup.status == 'active'
            }
          : access.skillMarketplace
            ? {
                type: 'skill_marketplace',
                oid: access.skillMarketplace.oid,
                instanceOid: access.skillMarketplace.instanceOid,
                resourceGroupOid: access.skillMarketplace.resourceGroupOid,
                active: access.skillMarketplace.status == 'active'
              }
            : null;
    let targetMatchesType =
      (access.type == 'skill' && access.skillOid != null) ||
      (access.type == 'skill_template' && access.skillTemplateOid != null) ||
      (access.type == 'skill_group' && access.skillGroupOid != null) ||
      (access.type == 'skill_marketplace' && access.skillMarketplaceOid != null);
    if (!resource || targetCount != 1 || !targetMatchesType) {
      dataIssues.push({
        recordKey: `consumer_access:${access.oid}`,
        classification: 'stale_legacy',
        payload: {
          consumerAccessOid: access.oid,
          reason: 'malformed_or_type_mismatched_consumer_access'
        }
      });
      continue;
    }
    let profiles = getEffectiveGroupProfiles(access.consumerGroup);
    for (let profile of profiles) {
      if (
        !resource.active ||
        profile.instanceOid != resource.instanceOid ||
        profile.surfaceOid != access.surfaceOid
      ) {
        dataIssues.push({
          recordKey: `consumer_access:${access.oid}:profile:${profile.oid}`,
          classification: 'stale_legacy',
          payload: {
            consumerAccessOid: access.oid,
            consumerProfileOid: profile.oid,
            reason: 'inactive_or_cross_instance_or_cross_surface'
          }
        });
        continue;
      }
      add({
        profileOid: profile.oid,
        instanceOid: profile.instanceOid,
        surfaceOid: profile.surfaceOid,
        resourceGroupOid: resource.resourceGroupOid,
        resourceType: resource.type,
        resourceOid: resource.oid,
        action: 'read',
        source: 'consumer_access',
        sourceOid: access.oid
      });
    }
  }

  for (let participant of d.stage == 'canonical' ? [] : storeParticipants) {
    let profile = participant.resourceActor.consumerProfile;
    let skill = participant.store.skill;
    if (!profile || !skill) continue;
    if (participant.permissions.length == 0) continue;
    if (
      profile.instanceOid != skill.instanceOid ||
      participant.store.resourceGroupOid != skill.resourceGroupOid
    ) {
      dataIssues.push({
        recordKey: `store_participant:${participant.oid}`,
        classification: 'stale_legacy',
        payload: {
          storeParticipantOid: participant.oid,
          reason: 'store_participant_scope_mismatch'
        }
      });
      continue;
    }
    // StoreParticipant is attribution/operational state only. It deliberately
    // contributes no effective authorization row.
  }

  let groupRows = rows.filter(
    row => row.resourceType == 'skill_group' && row.action == 'read'
  );
  let groupItems = await database.skillGroupItem.findMany({
    where: {
      status: 'active',
      skillGroup: { status: 'active' },
      skillGroupOid: { in: [...new Set(groupRows.map(row => row.resourceOid))] }
    },
    include: { skill: true, skillGroup: true }
  });
  for (let groupRow of groupRows) {
    for (let item of groupItems.filter(item => item.skillGroupOid == groupRow.resourceOid)) {
      if (item.skill.status != 'active' || item.skill.instanceOid != groupRow.instanceOid) {
        continue;
      }
      add({
        ...groupRow,
        resourceGroupOid: item.skill.resourceGroupOid,
        resourceType: 'skill',
        resourceOid: item.skillOid,
        source: 'skill_group_inheritance',
        sourceOid: item.oid
      });
    }
  }

  let marketplaceRows = rows.filter(
    row => row.resourceType == 'skill_marketplace' && row.action == 'read'
  );
  let marketplacePlugins = await database.skillMarketplacePlugin.findMany({
    where: {
      status: 'active',
      skillMarketplace: { status: 'active' },
      skillPlugin: { status: 'active' },
      skillMarketplaceOid: {
        in: [...new Set(marketplaceRows.map(row => row.resourceOid))]
      }
    },
    include: { skillPlugin: true }
  });
  for (let marketplaceRow of marketplaceRows) {
    for (let plugin of marketplacePlugins.filter(
      plugin => plugin.skillMarketplaceOid == marketplaceRow.resourceOid
    )) {
      if (plugin.skillPlugin.instanceOid != marketplaceRow.instanceOid) continue;
      add({
        ...marketplaceRow,
        resourceGroupOid: plugin.skillPlugin.resourceGroupOid,
        resourceType: 'skill_plugin',
        resourceOid: plugin.skillPluginOid,
        source: 'skill_marketplace_inheritance',
        sourceOid: plugin.oid
      });
    }
  }

  let writableSkillRows = rows.filter(
    row => row.resourceType == 'skill' && row.action == 'write'
  );
  let assignableGroups = new Set(
    (
      await database.skillGroup.findMany({
        where: {
          oid: { in: [...new Set(groupRows.map(row => row.resourceOid))] },
          status: 'active',
          allowConsumerSkillAssignment: true
        },
        select: { oid: true }
      })
    ).map(group => group.oid)
  );
  for (let groupRow of groupRows) {
    if (!assignableGroups.has(groupRow.resourceOid)) continue;
    for (let skillRow of writableSkillRows.filter(
      skillRow =>
        skillRow.profileOid == groupRow.profileOid &&
        skillRow.instanceOid == groupRow.instanceOid &&
        skillRow.surfaceOid == groupRow.surfaceOid
    )) {
      add({
        ...groupRow,
        resourceType: `skill_group_assignment:${groupRow.resourceOid}`,
        resourceOid: skillRow.resourceOid,
        resourceGroupOid: skillRow.resourceGroupOid,
        action: 'assign_skill',
        source: 'group_share_and_skill_write',
        sourceOid: skillRow.sourceOid
      });
    }
  }

  // Cargo content inherits through any owning skill. Expand each effective
  // skill read/write path to its store and current file/document items without
  // copying access tags onto those child records.
  let skillRows = rows.filter(
    row => row.resourceType == 'skill' && (row.action == 'read' || row.action == 'write')
  );
  let owningSkills = await database.skill.findMany({
    where: { oid: { in: [...new Set(skillRows.map(row => row.resourceOid))] } },
    select: {
      oid: true,
      store: {
        select: {
          oid: true,
          resourceGroupOid: true,
          items: {
            select: { fileOid: true, documentOid: true }
          }
        }
      }
    }
  });
  let skillOwners = new Map(owningSkills.map(skill => [skill.oid, skill.store]));
  for (let skillRow of skillRows) {
    let store = skillOwners.get(skillRow.resourceOid);
    if (!store) continue;
    add({
      ...skillRow,
      resourceGroupOid: store.resourceGroupOid,
      resourceType: 'store',
      resourceOid: store.oid
    });
    for (let item of store.items) {
      if (item.fileOid) {
        add({
          ...skillRow,
          resourceGroupOid: store.resourceGroupOid,
          resourceType: 'file',
          resourceOid: item.fileOid
        });
      }
      if (item.documentOid) {
        add({
          ...skillRow,
          resourceGroupOid: store.resourceGroupOid,
          resourceType: 'document',
          resourceOid: item.documentOid
        });
      }
    }
  }

  let uniqueRows = new Map(rows.map(row => [snapshotKey(row), row]));
  await replaceMigrationArtifacts({
    database,
    runId: d.runId,
    stage: d.stage,
    kind: 'effective_access',
    immutable: d.stage == 'pre_actor',
    artifacts: [...uniqueRows].map(([recordKey, payload]) => ({
      recordKey,
      classification: 'allowed',
      payload
    }))
  });
  await replaceMigrationArtifacts({
    database,
    runId: d.runId,
    stage: d.stage,
    kind: 'data_issue',
    immutable: d.stage == 'pre_actor',
    artifacts: dataIssues
  });
  await replaceMigrationArtifacts({
    database,
    runId: d.runId,
    stage: d.stage,
    kind: 'participant_evidence',
    immutable: d.stage == 'pre_actor',
    artifacts: skillParticipants.map(participant => ({
      recordKey: `skill_participant:${participant.oid}`,
      classification: 'observational',
      payload: {
        skillParticipantOid: participant.oid,
        skillParticipantId: participant.id,
        skillOid: participant.skillOid,
        resourceActorOid: participant.resourceActorOid,
        consumerProfileOid: participant.resourceActor.consumerProfileOid,
        organizationActorOid: participant.resourceActor.organizationActorOid,
        roles: participant.roles,
        grantsAuthorization: participantEvidenceGrantsAuthorization()
      }
    }))
  });

  return { rows: uniqueRows.size };
};

export let inventoryLegacyAccess = async (d: {
  runId: string;
  stage: 'pre_actor' | 'post_actor' | 'canonical';
}) =>
  await db.$transaction(
    async database => await inventoryLegacyAccessInTransaction({ ...d, database }),
    {
      isolationLevel: 'RepeatableRead',
      timeout: 10 * 60 * 1000
    }
  );
