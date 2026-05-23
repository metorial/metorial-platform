import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { skillTemplateItemType } from '../../types';
import { v1IntegrationPreviewPresenter, v1ProviderPreview } from '../provider';

export let v1SkillTemplateItemPresenter = Presenter.create(skillTemplateItemType)
  .presenter(async ({ skillTemplateItem }) => ({
    object: 'skill.template.item' as const,
    id: skillTemplateItem.id,
    type: skillTemplateItem.type,
    integration: skillTemplateItem.integration
      ? v1IntegrationPreviewPresenter(skillTemplateItem.integration)
      : null,
    provider: skillTemplateItem.provider
      ? v1ProviderPreview(skillTemplateItem.provider)
      : null,
    created_at: skillTemplateItem.createdAt,
    updated_at: skillTemplateItem.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.template.item'),
      id: v.string(),
      type: v.enumOf(['integration', 'provider']),
      integration: v.nullable(v1IntegrationPreviewPresenter.schema),
      provider: v.nullable(v1ProviderPreview.schema),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
