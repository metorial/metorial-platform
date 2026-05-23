import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { skillAgentType } from '../../types';

export let v1SkillAgentPresenter = Presenter.create(skillAgentType)
  .presenter(async ({ skillAgent }) => ({
    object: 'skill.agent' as const,
    id: skillAgent.id,
    skill_id: skillAgent.skillId,
    name: skillAgent.name,
    description: skillAgent.description,
    slug: skillAgent.slug,
    status: skillAgent.status,
    store_id: skillAgent.storeId,
    store_item_id: skillAgent.storeItemId ?? null,
    path: skillAgent.path ?? null,
    document_id: skillAgent.documentId,
    archived_at: skillAgent.archivedAt,
    created_at: skillAgent.createdAt,
    updated_at: skillAgent.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.agent', {
        description: "String representing the object's type"
      }),
      id: v.string(),
      skill_id: v.string(),
      name: v.string(),
      description: v.nullable(v.string()),
      slug: v.string(),
      status: v.enumOf(['active', 'archived']),
      store_id: v.string(),
      store_item_id: v.nullable(v.string()),
      path: v.nullable(v.string()),
      document_id: v.string(),
      archived_at: v.nullable(v.date()),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
