import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { skillContentPreviewType } from '../../types';

export let v1SkillContentPreviewPresenter = Presenter.create(skillContentPreviewType)
  .presenter(async ({ skillContentPreview }) => ({
    object: 'skill.content_preview' as const,

    skill_id: skillContentPreview.skillId,
    content: skillContentPreview.content
  }))
  .schema(
    v.object({
      object: v.literal('skill.content_preview', {
        description: "String representing the object's type"
      }),
      skill_id: v.string({
        description: 'The ID of the skill the preview belongs to.'
      }),
      content: v.nullable(
        v.string({
          description:
            "The beginning of the skill's SKILL.md file, or null if the skill has no SKILL.md or it is not readable by the caller."
        })
      )
    })
  )
  .build();
