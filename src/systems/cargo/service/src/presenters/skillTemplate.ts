import type {
  SkillTemplateRecord,
  SkillTemplateSummaryRecord
} from '../services/skillTemplate';
import { storeTemplateDetailPresenter, storeTemplatePresenter } from './storeTemplate';

export let skillTemplatePresenter = (
  skillTemplate: SkillTemplateSummaryRecord | SkillTemplateRecord
) => ({
  object: 'cargo#skillTemplate',
  id: skillTemplate.id,
  systemIdentifier: skillTemplate.systemIdentifier ?? undefined,
  storeTemplateId: skillTemplate.storeTemplate.id,
  storeTemplate: storeTemplatePresenter(skillTemplate.storeTemplate),
  createdAt: skillTemplate.createdAt,
  updatedAt: skillTemplate.updatedAt
});

export let skillTemplateDetailPresenter = (skillTemplate: SkillTemplateRecord) => ({
  ...skillTemplatePresenter(skillTemplate),
  storeTemplate: storeTemplateDetailPresenter(skillTemplate.storeTemplate)
});
