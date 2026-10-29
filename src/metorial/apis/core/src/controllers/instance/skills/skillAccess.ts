import { skillAccessGrantService } from '@metorial/module-skill';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { skillAccessPresenter } from '@metorial/presenters';
import { skillGroup } from './skill';

export let skillAccessController = Controller.create(
  {
    name: 'Skill Access',
    description: 'Inspect who has been granted access to an instance skill.'
  },
  {
    get: skillGroup
      .get(instancePath('skills/:skillId/access', 'skills.access.get'), {
        name: 'Get skill access',
        description: 'Returns the access grants of a specific skill.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(
        checkAccess({
          possibleScopes: ['instance.skill:read', 'consumer#instance.skill:read']
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .output(skillAccessPresenter)
      .do(async ctx => {
        let access = await getInstanceCargoAccess(ctx);
        let grants = await skillAccessGrantService.listSkillAccessGrants({
          project: ctx.project,
          skill: ctx.skill,
          authorization: access.authorization
        });

        return skillAccessPresenter.present({ skill: ctx.skill, grants });
      })
  }
);
