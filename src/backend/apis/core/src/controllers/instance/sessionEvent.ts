import { sessionEventService } from '@metorial/module-session';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { sessionEventPresenter } from '../../presenters';
import { sessionGroup } from './session';

export let sessionEventGroup = sessionGroup.use(async ctx => {
  if (!ctx.params.sessionEventId) throw new Error('sessionEventId is required');

  let sessionEvent = await sessionEventService.getSessionEventById({
    sessionEventId: ctx.params.sessionEventId,
    session: ctx.session
  });

  return { sessionEvent };
});

export let sessionEventController = Controller.create(
  {
    name: 'Session Event',
    description: 'Read and write session event information'
  },
  {
    list: sessionGroup
      .get(instancePath('sessions/:sessionId/events', 'sessions.events.list'), {
        name: 'List session events',
        description: 'List all session events'
      })
      .use(checkAccess({ possibleScopes: ['instance.session:read'] }))
      .outputList(sessionEventPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            server_run_ids: v.optional(v.union([v.string(), v.array(v.string())])),
            server_session_ids: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await sessionEventService.listSessionEvents({
          session: ctx.session,
          serverRunIds: normalizeArrayParam(ctx.query.server_run_ids),
          serverSessionIds: normalizeArrayParam(ctx.query.server_session_ids)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sessionEvent =>
          sessionEventPresenter.present({ sessionEvent, session: ctx.session })
        );
      }),

    get: sessionEventGroup
      .get(instancePath('sessions/:sessionId/events/:sessionEventId', 'sessions.events.get'), {
        name: 'Get session event',
        description: 'Get the information of a specific session event'
      })
      .use(checkAccess({ possibleScopes: ['instance.session:read'] }))
      .output(sessionEventPresenter)
      .do(async ctx => {
        return sessionEventPresenter.present({
          sessionEvent: ctx.sessionEvent,
          session: ctx.session
        });
      })
  }
);
