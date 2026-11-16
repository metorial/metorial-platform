import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { storeParticipantService } from '@metorial/module-store';
import { Controller } from '@metorial/rest';
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

  if (!ctx.skill.store) {
    throw new ServiceError(notFoundError('skill.participant', ctx.params.skillParticipantId));
  }

  let participant = await storeParticipantService.getStoreResourceParticipantById({
    project: ctx.project,
    instance: ctx.instance,
    store: ctx.skill.store,
    participantId: ctx.params.skillParticipantId
  });

  let organizationMemberParticipantOids =
    await storeParticipantService.findOrganizationMemberParticipantOids({
      project: ctx.project,
      participants: [participant]
    });

  return {
    skillParticipant: {
      ...participant,
      skill: ctx.skill,
      hasOrganizationMemberAccess: organizationMemberParticipantOids.has(participant.oid)
    }
  };
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
        let store = ctx.skill.store;
        if (!store) throw new ServiceError(notFoundError('skill.store', ctx.skill.id));

        let paginator = await storeParticipantService.listStoreResourceParticipants({
          project: ctx.project,
          instance: ctx.instance,
          store
        });
        let list = await paginator.run(ctx.query);
        let organizationMemberParticipantOids =
          await storeParticipantService.findOrganizationMemberParticipantOids({
            project: ctx.project,
            participants: list.items
          });

        return Paginator.present(list, participant =>
          skillParticipantPresenter.present({
            skillParticipant: {
              ...participant,
              skill: ctx.skill,
              hasOrganizationMemberAccess: organizationMemberParticipantOids.has(
                participant.oid
              )
            }
          })
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
