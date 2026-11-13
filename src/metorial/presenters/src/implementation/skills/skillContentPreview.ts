import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { skillContentPreviewType } from '../../types';

export let v1SkillContentPreviewPresenter = Presenter.create(skillContentPreviewType)
  .presenter(async ({ skillContentPreview }) => ({
    object: 'skill.content_preview' as const,

    type: skillContentPreview.type,
    skill_id: skillContentPreview.type == 'skill' ? skillContentPreview.skillId : null,
    skill_template_id:
      skillContentPreview.type == 'skill_template'
        ? skillContentPreview.skillTemplateId
        : null,
    content: skillContentPreview.content
  }))
  .schema(
    v.object({
      object: v.literal('skill.content_preview', {
        description: "String representing the object's type"
      }),
      type: v.enumOf(['skill', 'skill_template'], {
        description: 'Whether the preview belongs to a skill or a skill template.'
      }),
      skill_id: v.nullable(
        v.string({
          description: 'The ID of the skill the preview belongs to, if `type` is `skill`.'
        })
      ),
      skill_template_id: v.nullable(
        v.string({
          description:
            'The ID of the skill template the preview belongs to, if `type` is `skill_template`.'
        })
      ),
      content: v.nullable(
        v.string({
          description:
            'The beginning of the SKILL.md file, or null if there is no SKILL.md or it is not readable by the caller.'
        })
      )
    })
  )
  .build();
