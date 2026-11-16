import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillContentPreviewService } from '@metorial/module-skill';
import { skillContentPreviewPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';

let readScopes = ['instance.skill:read', 'consumer#instance.skill:read'] as const;

export let skillContentPreviewController = Controller.create(
  {
    name: 'Skill Content Previews',
    description:
      'Read the beginning of the SKILL.md of many skills and skill templates at once.'
  },
  {
    list: instanceGroup
      .get(instancePath('skill-content-previews', 'skills.contentPreviews.list'), {
        name: 'List skill content previews',
        description:
          'Returns the beginning of the SKILL.md file of up to 50 skills and skill templates in a single request.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .outputList(skillContentPreviewPresenter)
      .query(
        'default',
        v.object({
          skill_id: v.optional(
            v.union([v.string(), v.array(v.string())], {
              description: 'The IDs of the skills to preview.'
            })
          ),
          skill_template_id: v.optional(
            v.union([v.string(), v.array(v.string())], {
              description: 'The IDs of the skill templates to preview.'
            })
          )
        })
      )
      .do(async ctx => {
        let skillContentPreviews = await skillContentPreviewService.listSkillContentPreviews({
          ...(await getInstanceCargoAccess(ctx)),
          accessTags: ctx.consumerProfile ? ctx.accessTags : undefined,
          skillIds: normalizeArrayParam(ctx.query.skill_id) ?? [],
          skillTemplateIds: normalizeArrayParam(ctx.query.skill_template_id) ?? []
        });

        return Paginator.present(
          {
            items: skillContentPreviews,
            pagination: { hasNextPage: false, hasPreviousPage: false }
          },
          skillContentPreview => skillContentPreviewPresenter.present({ skillContentPreview })
        );
      })
  }
);
