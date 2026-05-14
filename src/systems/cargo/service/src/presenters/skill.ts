import type { SkillRecord } from '../services/skill';
import { storePresenter } from './store';

export let skillPresenter = (skill: SkillRecord) => ({
  object: 'cargo#skill',
  id: skill.id,
  image: skill.image,
  storeId: skill.store.id,
  store: storePresenter(skill.store),
  parentSkillId: skill.parentSkill?.id,
  parentSkillTemplateId: skill.parentSkillTemplate?.id,
  createdAt: skill.createdAt
});
