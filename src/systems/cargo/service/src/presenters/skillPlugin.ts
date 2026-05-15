import type { SkillPluginRecord } from '@metorial-cargo/module-skill';
import { skillPluginSkillPresenter } from './skillPluginSkill';

export let skillPluginPresenter = (skillPlugin: SkillPluginRecord) => ({
  object: 'cargo#skillPlugin',
  id: skillPlugin.id,
  status: skillPlugin.status,
  isManaged: skillPlugin.isManaged,
  image: skillPlugin.image,
  providerOverrides: skillPlugin.providerOverrides,
  version: skillPlugin.version,
  name: skillPlugin.name,
  description: skillPlugin.description,
  longDescription: skillPlugin.longDescription,
  category: skillPlugin.category,
  slug: skillPlugin.slug,
  skillConfigurationId: skillPlugin.skillConfiguration?.id,
  skills: skillPlugin.skillPluginSkills.map(skillPluginSkillPresenter),
  createdAt: skillPlugin.createdAt,
  updatedAt: skillPlugin.updatedAt
});
