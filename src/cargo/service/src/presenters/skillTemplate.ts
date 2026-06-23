import type {
  SkillTemplateRecord,
  SkillTemplateSummaryRecord,
  SkillTemplateWithScopedStoreId
} from '@metorial-cargo/module-skill';
import { storeTemplateDetailPresenter, storeTemplatePresenter } from './storeTemplate';

export let skillTemplatePresenter = (
  skillTemplate:
    | SkillTemplateWithScopedStoreId<SkillTemplateSummaryRecord>
    | SkillTemplateWithScopedStoreId<SkillTemplateRecord>
) => ({
  object: 'cargo#skillTemplate',
  id: skillTemplate.id,
  systemIdentifier: skillTemplate.systemIdentifier ?? undefined,
  storeTemplateId: skillTemplate.storeTemplate.id,
  storeId:
    skillTemplate.storeTemplate.storeId ??
    skillTemplate.storeTemplate.sourceStore?.id ??
    undefined,
  storeTemplate: storeTemplatePresenter(skillTemplate.storeTemplate),
  createdAt: skillTemplate.createdAt,
  updatedAt: skillTemplate.updatedAt
});

export let skillTemplateDetailPresenter = (
  skillTemplate: SkillTemplateWithScopedStoreId<SkillTemplateRecord>
) => ({
  ...skillTemplatePresenter(skillTemplate),
  storeTemplate: storeTemplateDetailPresenter(skillTemplate.storeTemplate)
});
