import type { SkillRecord } from '@metorial-cargo/module-skill';
import { storePresenter } from './store';

export let skillPresenter = (skill: SkillRecord) => ({
  object: 'cargo#skill',
  id: skill.id,
  image: skill.image,
  name: skill.name,
  description: skill.description,
  metadata: skill.metadata,
  clientName: skill.clientName,
  clientDescription: skill.clientDescription,
  clientMetadata: skill.clientMetadata,
  license: skill.license,
  compatibility: skill.compatibility,
  storeId: skill.store.id,
  store: storePresenter(skill.store),
  parentSkillId: skill.parentSkill?.id,
  parentSkillTemplateId: skill.parentSkillTemplate?.id,
  createdAt: skill.createdAt
});
