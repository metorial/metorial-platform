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
import { isDashboardGroup } from '../../../middleware/isDashboard';

let readScopes = ['instance.skill:read'] as const;

export let skillContentPreviewController = Controller.create(
  {
    name: 'Skill Content Previews',
    description: 'Read the beginning of the SKILL.md of many skills at once.'
  },
  {
    list: instanceGroup
      .get(instancePath('skill-content-previews', 'skills.contentPreviews.list'), {
        name: 'List skill content previews',
        description:
          'Returns the beginning of the SKILL.md file of up to 50 skills in a single request.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(isDashboardGroup())
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .outputList(skillContentPreviewPresenter)
      .query(
        'default',
        v.object({
          id: v.union([v.string(), v.array(v.string())], {
            description:
              'The IDs of the skills to preview. At most 50 can be requested at once.'
          })
        })
      )
      .do(async ctx => {
        let skillContentPreviews = await skillContentPreviewService.listSkillContentPreviews({
          ...(await getInstanceCargoAccess(ctx)),
          skillIds: normalizeArrayParam(ctx.query.id) ?? []
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
