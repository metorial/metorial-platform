import type { SkillPluginRecord, SkillPluginSkillRecord } from '@metorial-cargo/module-skill';
import { skillPresenter } from './skill';

type PresentableSkillPluginSkill =
  | SkillPluginSkillRecord
  | SkillPluginRecord['skillPluginSkills'][number];

export let skillPluginSkillPresenter = (skillPluginSkill: PresentableSkillPluginSkill) => ({
  object: 'cargo#skillPluginSkill',
  id: skillPluginSkill.id,
  status: skillPluginSkill.status,
  pluginSkillSlug: skillPluginSkill.pluginSkillSlug,
  clientName: skillPluginSkill.clientName,
  clientDescription: skillPluginSkill.clientDescription,
  clientMetadata: skillPluginSkill.clientMetadata,
  license: skillPluginSkill.license,
  compatibility: skillPluginSkill.compatibility,
  skillConfigurationId: skillPluginSkill.skillConfiguration?.id,
  skillId: skillPluginSkill.skill.id,
  skill: skillPresenter(skillPluginSkill.skill),
  skillPluginId: 'skillPlugin' in skillPluginSkill ? skillPluginSkill.skillPlugin.id : undefined,
  createdAt: skillPluginSkill.createdAt,
  updatedAt: skillPluginSkill.updatedAt
});
