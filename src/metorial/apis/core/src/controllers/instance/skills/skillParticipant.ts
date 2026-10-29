import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { isStoreResourceFlagEnabled } from '@metorial/module-access';
import { skillParticipantService } from '@metorial/module-skill';
import { storeParticipantService } from '@metorial/module-store';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { skillParticipantPresenter } from '@metorial/presenters';
import { skillGroup } from './skill';

let skillReadScopes = ['instance.skill:read', 'consumer#instance.skill:read'] as const;

export let skillParticipantGroup = skillGroup.use(async ctx => {
  if (!ctx.params.skillParticipantId) {
    throw new Error('skillParticipantId is required');
  }

  if (
    ctx.skill.store &&
    (await isStoreResourceFlagEnabled({ project: ctx.project, flag: 'store-participants-v2' }))
  ) {
    let participant = await storeParticipantService.getStoreResourceParticipantById({
      project: ctx.project,
      instance: ctx.instance,
      store: ctx.skill.store,
      participantId: ctx.params.skillParticipantId
    });

    return { skillParticipant: { ...participant, skill: ctx.skill } };
  }

  let skillParticipant = await skillParticipantService.getSkillParticipantById({
    skillParticipantId: ctx.params.skillParticipantId,
    ...(await getInstanceCargoAccess(ctx))
  });

  if (skillParticipant.skill.id !== ctx.skill.id) {
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
        if (
          ctx.skill.store &&
          (await isStoreResourceFlagEnabled({
            project: ctx.project,
            flag: 'store-participants-v2'
          }))
        ) {
          let paginator = await storeParticipantService.listStoreResourceParticipants({
            project: ctx.project,
            instance: ctx.instance,
            store: ctx.skill.store
          });
          let list = await paginator.run(ctx.query);

          return Paginator.present(list, participant =>
            skillParticipantPresenter.present({
              skillParticipant: { ...participant, skill: ctx.skill }
            })
          );
        }

        let paginator = await skillParticipantService.listSkillParticipants({
          skillId: ctx.skill.id,
          ...(await getInstanceCargoAccess(ctx))
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
