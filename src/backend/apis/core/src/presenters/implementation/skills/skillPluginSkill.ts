import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { skillPluginSkillType } from '../../types';

export let v1SkillPluginSkillPresenter = Presenter.create(skillPluginSkillType)
  .presenter(async ({ skillPluginSkill }) => ({
    object: 'skill.plugin_skill' as const,
    id: skillPluginSkill.id,
    identifier: skillPluginSkill.pluginSkillSlug,
    status: skillPluginSkill.status,
    client_name: skillPluginSkill.clientName,
    client_description: skillPluginSkill.clientDescription,
    client_metadata: skillPluginSkill.clientMetadata,
    license: skillPluginSkill.license,
    compatibility: skillPluginSkill.compatibility,
    skill_configuration_id: skillPluginSkill.skillConfigurationId ?? null,
    skill_id: skillPluginSkill.skillId,
    created_at: skillPluginSkill.createdAt,
    updated_at: skillPluginSkill.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.plugin_skill'),
      id: v.string(),
      identifier: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      client_name: v.nullable(v.string()),
      client_description: v.nullable(v.string()),
      client_metadata: v.nullable(v.record(v.any())),
      license: v.nullable(v.string()),
      compatibility: v.nullable(v.string()),
      skill_configuration_id: v.nullable(v.string()),
      skill_id: v.string(),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
