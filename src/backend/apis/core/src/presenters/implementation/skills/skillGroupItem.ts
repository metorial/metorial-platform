import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { skillGroupItemType } from '../../types';
import { v1SkillPreviewPresenter } from './skill';

export let v1SkillGroupItemPresenter = Presenter.create(skillGroupItemType)
  .presenter(async ({ skillGroupItem }) => ({
    object: 'skill.group.item' as const,
    id: skillGroupItem.id,
    status: skillGroupItem.status,
    skill_group_id: skillGroupItem.skillGroupId,
    skill: v1SkillPreviewPresenter(skillGroupItem.skill),
    created_at: skillGroupItem.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.group.item'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      skill_group_id: v.string(),
      skill: v1SkillPreviewPresenter.schema,
      created_at: v.date()
    })
  )
  .build();
