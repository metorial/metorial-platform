import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceSessionEventService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { subspaceSessionEventPresenter } from '../../presenters';
import { SubspaceSessionEvent } from '../../presenters/types';
import { subspaceSessionGroup } from './subspaceSession';

export let subspaceSessionEventGroup = subspaceSessionGroup.use(async ctx => {
  if (!ctx.params.sessionEventId) {
    throw new ServiceError(
      badRequestError({
        message: 'sessionEventId is required',
        description: 'The sessionEventId path parameter is required.'
      })
    );
  }

  let sessionEvent = await subspaceSessionEventService.get({
    instance: ctx.instance,
    sessionEventId: ctx.params.sessionEventId
  });

  return { sessionEvent };
});

export let subspaceSessionEventController = Controller.create(
  {
    name: 'Session Events',
    description:
      'Session events represent significant occurrences during a session, such as errors or state changes. This read-only resource provides visibility into session activity.'
  },
  {
    list: subspaceSessionGroup
      .get(instancePath('sessions/:sessionId/events', 'sessions.events.list'), {
        name: 'List session events',
        description: 'Returns a paginated list of events for a session.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(subspaceSessionEventPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            type: v.optional(v.string(), { description: 'Filter by event type' }),
            session_provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session provider ID(s)'
            }),
            provider_run_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider run ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSessionEventService.list({
          instance: ctx.instance,
          sessionIds: [ctx.session.id],
          sessionProviderIds: normalizeArrayParam(ctx.query.session_provider_id),
          providerRunIds: normalizeArrayParam(ctx.query.provider_run_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sessionEvent =>
          subspaceSessionEventPresenter.present({
            sessionEvent: sessionEvent as SubspaceSessionEvent
          })
        );
      }),

    get: subspaceSessionEventGroup
      .get(instancePath('sessions/:sessionId/events/:sessionEventId', 'sessions.events.get'), {
        name: 'Get session event',
        description: 'Retrieves a specific event from a session.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(subspaceSessionEventPresenter)
      .do(async ctx => {
        return subspaceSessionEventPresenter.present({
          sessionEvent: ctx.sessionEvent as SubspaceSessionEvent
        });
      })
  }
);
