import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { skillParticipantService } from '@metorial/module-file';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { skillParticipantPresenter } from '../../../presenters';
import { skillGroup } from './skill';

let skillReadScopes = ['instance.skill:read', 'consumer#instance.skill:read'] as const;

export let skillParticipantGroup = skillGroup.use(async ctx => {
  if (!ctx.params.skillParticipantId) {
    throw new Error('skillParticipantId is required');
  }

  let skillParticipant = await skillParticipantService.getSkillParticipantById({
    skillParticipantId: ctx.params.skillParticipantId,
    owner: {
      type: 'instance',
      instance: ctx.instance,
      organization: ctx.organization
    },
    ...getInstanceCargoAccess(ctx)
  });

  if (skillParticipant.skillId !== ctx.skill.id) {
    throw new ServiceError(notFoundError('skill.participant', ctx.params.skillParticipantId));
  }

  return { skillParticipant };
});

export let skillParticipantController = Controller.create(
  {
    name: 'Skill Participants',
    description: 'Inspect participants associated with an instance skill.'
  },
  {
    list: skillGroup
      .get(instancePath('skills/:skillId/participants', 'skills.participants.list'), {
        name: 'List skill participants',
        description: 'Returns a paginated list of participants for a specific skill.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillReadScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .outputList(skillParticipantPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await skillParticipantService.listSkillParticipants({
          skillId: ctx.skill.id,
          owner: {
            type: 'instance',
            instance: ctx.instance,
            organization: ctx.organization
          },
          ...getInstanceCargoAccess(ctx)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, skillParticipant =>
          skillParticipantPresenter.present({ skillParticipant })
        );
      }),

    get: skillParticipantGroup
      .get(
        instancePath(
          'skills/:skillId/participants/:skillParticipantId',
          'skills.participants.get'
        ),
        {
          name: 'Get skill participant by ID',
          description: 'Retrieves a specific participant within a skill.'
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillReadScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillParticipantPresenter)
      .do(async ctx =>
        skillParticipantPresenter.present({ skillParticipant: ctx.skillParticipant })
      )
  }
);
