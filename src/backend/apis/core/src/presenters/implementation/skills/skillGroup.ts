import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { skillGroupType } from '../../types';
import { v1SkillPreviewPresenter } from './skill';

export let v1SkillGroupPresenter = Presenter.create(skillGroupType)
  .presenter(async ({ skillGroup }) => ({
    object: 'skill.group' as const,
    id: skillGroup.id,
    status: skillGroup.status,
    name: skillGroup.name,
    description: skillGroup.description,
    metadata: skillGroup.metadata,
    skills: await Promise.all(skillGroup.skills.map(skill => v1SkillPreviewPresenter(skill))),
    created_at: skillGroup.createdAt,
    updated_at: skillGroup.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.group'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      name: v.string(),
      description: v.nullable(v.string()),
      metadata: v.nullable(v.record(v.any())),
      skills: v.array(v1SkillPreviewPresenter.schema),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
