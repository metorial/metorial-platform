import type { Skill, SkillMarketplace, SkillPlugin } from '@metorial/db';
import {
  Fabric,
  type AuditSkillGroup,
  type AuditSkillMergeRequest,
  type AuditSkillTemplate,
  type FabricEvents
} from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

let skillPayload = (skill: Skill) => ({
  id: skill.id,
  name: skill.name,
  slug: skill.slug,
  description: skill.description,
  status: skill.status,
  license: skill.license,
  compatibility: skill.compatibility
});

let skillPluginPayload = (skillPlugin: SkillPlugin) => ({
  id: skillPlugin.id,
  name: skillPlugin.name,
  slug: skillPlugin.slug,
  description: skillPlugin.description,
  category: skillPlugin.category,
  status: skillPlugin.status
});

let skillMarketplacePayload = (skillMarketplace: SkillMarketplace) => ({
  id: skillMarketplace.id,
  name: skillMarketplace.name,
  slug: skillMarketplace.slug,
  description: skillMarketplace.description,
  status: skillMarketplace.status,
  repositoryAccessMode: skillMarketplace.repositoryAccessMode,
  forceMergeOrPush: skillMarketplace.forceMergeOrPush,
  mergeBeforeChecksPass: skillMarketplace.mergeBeforeChecksPass
});

let skillGroupPayload = (group: AuditSkillGroup) => ({
  id: group.id,
  name: group.name,
  description: group.description,
  status: group.status,
  allowConsumerSkillAssignment: group.allowConsumerSkillAssignment,
  skillIds: group.skillIds
});

let skillTemplatePayload = (template: AuditSkillTemplate) => ({
  id: template.id,
  name: template.name,
  slug: template.slug,
  description: template.description,
  status: template.status
});

let skillMergeRequestPayload = (mergeRequest: AuditSkillMergeRequest) => ({
  id: mergeRequest.id,
  title: mergeRequest.title,
  status: mergeRequest.status,
  direction: mergeRequest.direction,
  sourceSkillId: mergeRequest.sourceSkillId,
  targetSkillId: mergeRequest.targetSkillId
});

export let recordSkillCreated = async (event: FabricEvents['skill.audit.created:after']) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'skill', 'create', {
      payload: {
        ...skillPayload(event.skill),
        parentSkillId: event.parentSkillId,
        parentSkillTemplateId: event.parentSkillTemplateId,
        cloneType: event.cloneType
      },
      recordedAt
    });
  });
};

export let recordSkillUpdated = async (event: FabricEvents['skill.audit.updated:after']) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'skill', 'update', {
      payload: skillPayload(event.skill),
      previousPayload: skillPayload(event.previousSkill),
      recordedAt
    });
  });
};

export let recordSkillArchived = async (event: FabricEvents['skill.audit.archived:after']) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'skill', 'archive', {
      payload: { ...skillPayload(event.skill), status: 'archived' },
      recordedAt
    });
  });
};

export let recordSkillPluginCreated = async (
  event: FabricEvents['skill.plugin.audit.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'skill_plugin', 'create', {
      payload: skillPluginPayload(event.skillPlugin),
      recordedAt
    });
  });
};

export let recordSkillPluginUpdated = async (
  event: FabricEvents['skill.plugin.audit.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'skill_plugin', 'update', {
      payload: skillPluginPayload(event.skillPlugin),
      previousPayload: skillPluginPayload(event.previousSkillPlugin),
      recordedAt
    });
  });
};

export let recordSkillPluginArchived = async (
  event: FabricEvents['skill.plugin.audit.archived:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'skill_plugin', 'archive', {
      payload: { ...skillPluginPayload(event.skillPlugin), status: 'archived' },
      recordedAt
    });
  });
};

export let recordSkillMarketplaceCreated = async (
  event: FabricEvents['skill.marketplace.audit.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'skill_marketplace', 'create', {
      payload: skillMarketplacePayload(event.skillMarketplace),
      recordedAt
    });
  });
};

export let recordSkillMarketplaceUpdated = async (
  event: FabricEvents['skill.marketplace.audit.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'skill_marketplace', 'update', {
      payload: skillMarketplacePayload(event.skillMarketplace),
      previousPayload: skillMarketplacePayload(event.previousSkillMarketplace),
      recordedAt
    });
  });
};

export let recordSkillMarketplaceArchived = async (
  event: FabricEvents['skill.marketplace.audit.archived:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'skill_marketplace', 'archive', {
      payload: { ...skillMarketplacePayload(event.skillMarketplace), status: 'archived' },
      recordedAt
    });
  });
};

Fabric.listen('skill.audit.created:after', recordSkillCreated);
Fabric.listen('skill.audit.updated:after', recordSkillUpdated);
Fabric.listen('skill.audit.archived:after', recordSkillArchived);

Fabric.listen('skill.plugin.audit.created:after', recordSkillPluginCreated);
Fabric.listen('skill.plugin.audit.updated:after', recordSkillPluginUpdated);
Fabric.listen('skill.plugin.audit.archived:after', recordSkillPluginArchived);

Fabric.listen('skill.marketplace.audit.created:after', recordSkillMarketplaceCreated);
Fabric.listen('skill.marketplace.audit.updated:after', recordSkillMarketplaceUpdated);
Fabric.listen('skill.marketplace.audit.archived:after', recordSkillMarketplaceArchived);

export let recordSkillGroupCreated = async (
  event: FabricEvents['skill.group.audit.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'skill_group', 'create', {
      payload: skillGroupPayload(event.skillGroup),
      recordedAt
    });
  });
};

export let recordSkillGroupUpdated = async (
  event: FabricEvents['skill.group.audit.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'skill_group', 'update', {
      payload: skillGroupPayload(event.skillGroup),
      previousPayload: skillGroupPayload(event.previousSkillGroup),
      recordedAt
    });
  });
};

export let recordSkillGroupArchived = async (
  event: FabricEvents['skill.group.audit.archived:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'skill_group', 'archive', {
      payload: { ...skillGroupPayload(event.skillGroup), status: 'archived' },
      recordedAt
    });
  });
};

export let recordSkillGroupSkillAdded = async (
  event: FabricEvents['skill.group.audit.skill_added:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'skill_group', 'add_skill', {
      payload: { id: event.skillGroupId, skillId: event.skillId },
      recordedAt
    });
  });
};

export let recordSkillGroupSkillRemoved = async (
  event: FabricEvents['skill.group.audit.skill_removed:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'skill_group', 'remove_skill', {
      payload: { id: event.skillGroupId, skillId: event.skillId },
      recordedAt
    });
  });
};

export let recordSkillTemplateCreated = async (
  event: FabricEvents['skill.template.audit.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'skill_template', 'create', {
      payload: skillTemplatePayload(event.skillTemplate),
      recordedAt
    });
  });
};

export let recordSkillTemplateUpdated = async (
  event: FabricEvents['skill.template.audit.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'skill_template', 'update', {
      payload: skillTemplatePayload(event.skillTemplate),
      previousPayload: skillTemplatePayload(event.previousSkillTemplate),
      recordedAt
    });
  });
};

export let recordSkillTemplateArchived = async (
  event: FabricEvents['skill.template.audit.archived:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'skill_template', 'archive', {
      payload: { ...skillTemplatePayload(event.skillTemplate), status: 'archived' },
      recordedAt
    });
  });
};

let recordSkillMergeRequest =
  (action: 'create' | 'merge' | 'close' | 'rollback') =>
  async (event: {
    auditScope: FabricEvents['skill.merge_request.audit.created:after']['auditScope'];
    mergeRequest: AuditSkillMergeRequest;
  }) => {
    await recordAuditEventAfterCommit(async recordedAt => {
      await auditTrackerService.recordEvent(event.auditScope, 'skill_merge_request', action, {
        payload: skillMergeRequestPayload(event.mergeRequest),
        recordedAt
      });
    });
  };

export let recordSkillMergeRequestCreated = recordSkillMergeRequest('create');
export let recordSkillMergeRequestMerged = recordSkillMergeRequest('merge');
export let recordSkillMergeRequestClosed = recordSkillMergeRequest('close');
export let recordSkillMergeRequestRolledBack = recordSkillMergeRequest('rollback');

Fabric.listen('skill.group.audit.created:after', recordSkillGroupCreated);
Fabric.listen('skill.group.audit.updated:after', recordSkillGroupUpdated);
Fabric.listen('skill.group.audit.archived:after', recordSkillGroupArchived);
Fabric.listen('skill.group.audit.skill_added:after', recordSkillGroupSkillAdded);
Fabric.listen('skill.group.audit.skill_removed:after', recordSkillGroupSkillRemoved);

Fabric.listen('skill.template.audit.created:after', recordSkillTemplateCreated);
Fabric.listen('skill.template.audit.updated:after', recordSkillTemplateUpdated);
Fabric.listen('skill.template.audit.archived:after', recordSkillTemplateArchived);

Fabric.listen('skill.merge_request.audit.created:after', recordSkillMergeRequestCreated);
Fabric.listen('skill.merge_request.audit.merged:after', recordSkillMergeRequestMerged);
Fabric.listen('skill.merge_request.audit.closed:after', recordSkillMergeRequestClosed);
Fabric.listen(
  'skill.merge_request.audit.rolled_back:after',
  recordSkillMergeRequestRolledBack
);
