import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { skillTemplateType } from '../../types';
import { v1SkillTemplateItemPresenter } from './skillTemplateItem';

export let v1SkillTemplatePresenter = Presenter.create(skillTemplateType)
  .presenter(async ({ skillTemplate }, opts) => ({
    object: 'skill.template' as const,
    id: skillTemplate.id,
    status: skillTemplate.status,
    owner: skillTemplate.owner,
    slug: skillTemplate.slug,
    name: skillTemplate.name,
    description: skillTemplate.description,
    metadata: skillTemplate.metadata,
    store_id: skillTemplate.storeId!,
    items: await Promise.all(
      skillTemplate.items.map(item =>
        v1SkillTemplateItemPresenter.present({ skillTemplateItem: item }, opts).run()
      )
    ),
    created_at: skillTemplate.createdAt,
    updated_at: skillTemplate.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.template'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      owner: v.enumOf(['system', 'tenant']),
      slug: v.string(),
      name: v.string(),
      description: v.nullable(v.string()),
      metadata: v.record(v.any()),
      store_id: v.string(),
      items: v.array(v1SkillTemplateItemPresenter.schema),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
