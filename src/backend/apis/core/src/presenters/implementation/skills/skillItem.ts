import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { skillItemType } from '../../types';
import { v1IntegrationPreviewPresenter, v1ProviderPreview } from '../provider';

export let v1SkillItemPresenter = Presenter.create(skillItemType)
  .presenter(async ({ skillItem }) => ({
    object: 'skill.item' as const,
    id: skillItem.id,
    status: skillItem.status,
    type: skillItem.type,
    skill_id: skillItem.skillId,
    integration: skillItem.integration
      ? v1IntegrationPreviewPresenter(skillItem.integration)
      : null,
    provider: skillItem.provider ? v1ProviderPreview(skillItem.provider) : null,
    created_at: skillItem.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.item'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      type: v.enumOf(['integration', 'provider']),
      skill_id: v.string(),
      integration: v.nullable(v1IntegrationPreviewPresenter.schema),
      provider: v.nullable(v1ProviderPreview.schema),
      created_at: v.date()
    })
  )
  .build();
