import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillMergeRequestEventService } from '@metorial/module-skill-merge-requests';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { skillMergeRequestEventPresenter } from '@metorial/presenters';
import {
  getSkillMergeRequestAccess,
  skillMergeRequestGroup,
  skillMergeRequestReadScopes
} from './skillMergeRequest';

let eventTypeValidator = v.enumOf(
  [
    'created',
    'commented',
    'all_conflicts_resolved',
    'merge_started',
    'merge_completed',
    'merge_failed',
    'closed',
    'rolled_back'
  ],
  {
    description: 'What happened in the merge request.'
  }
);

export let skillMergeRequestEventController = Controller.create(
  {
    name: 'Skill Merge Request Events',
    description: 'A skill merge request event is one entry in a merge request activity history.',
    hideInDocs: true
  },
  {
    list: skillMergeRequestGroup
      .get(
        instancePath(
          'skill-merge-requests/:skillMergeRequestId/events',
          'skills.mergeRequests.events.list'
        ),
        {
          name: 'List skill merge request events',
          description: 'Returns a paginated activity history for a skill merge request.'
        }
      )
      .use(checkAccess({ possibleScopes: [...skillMergeRequestReadScopes] }))
      .outputList(skillMergeRequestEventPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            type: v.optional(
              v.union([eventTypeValidator, v.array(eventTypeValidator)], {
                description: 'Only return events of one of these types.'
              })
            ),
            created_at: dateFilterValidator('skill merge request event creation time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await skillMergeRequestEventService.listEvents({
          ...(await getSkillMergeRequestAccess(ctx)),
          mergeRequest: ctx.skillMergeRequest,
          types: normalizeArrayParam(ctx.query.type),
          createdAt: ctx.query.created_at
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, skillMergeRequestEvent =>
          skillMergeRequestEventPresenter.present({ skillMergeRequestEvent })
        );
      }),

    get: skillMergeRequestGroup
      .get(
        instancePath(
          'skill-merge-requests/:skillMergeRequestId/events/:eventId',
          'skills.mergeRequests.events.get'
        ),
        {
          name: 'Get skill merge request event',
          description: 'Retrieves one event from a skill merge request activity history.'
        }
      )
      .use(checkAccess({ possibleScopes: [...skillMergeRequestReadScopes] }))
      .output(skillMergeRequestEventPresenter)
      .do(async ctx => {
        let skillMergeRequestEvent =
          await skillMergeRequestEventService.getEventById({
            ...(await getSkillMergeRequestAccess(ctx)),
            mergeRequest: ctx.skillMergeRequest,
            eventId: ctx.params.eventId
          });

        return skillMergeRequestEventPresenter.present({ skillMergeRequestEvent });
      })
  }
);
