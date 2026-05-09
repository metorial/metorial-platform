import type { SkillRecord } from '../services/skill';
import { storePresenter } from './store';

export let skillPresenter = (skill: SkillRecord) => ({
  object: 'cargo#skill',
  id: skill.id,
  storeId: skill.store.id,
  store: storePresenter(skill.store),
  createdAt: skill.createdAt
});
