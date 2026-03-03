import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceSessionEventService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import {
  constrainFineGrainedSessionQuery,
  getFineGrainedAllowedSessionIds,
  requireFineGrainedSessionFromResource
} from '../../middleware/checkFineGrainedSessionAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { subspaceSessionEventPresenter } from '../../presenters';

let sessionEventGroup = instanceGroup
  .use(async ctx => {
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
  })
  .use(
    requireFineGrainedSessionFromResource(
      ctx =>
        ctx.sessionEvent?.sessionId ??
        ctx.sessionEvent?.session_id ??
        ctx.sessionEvent?.session?.id
    )()
  );

export let sessionEventController = Controller.create(
  {
    name: 'Session Events',
    description:
      'Session events represent significant occurrences during a session, such as errors or state changes. This read-only resource provides visibility into session activity.'
  },
  {
    list: instanceGroup
      .get(instancePath('session-events', 'sessions.events.list'), {
        name: 'List session events',
        description: 'Returns a paginated list of events for a session.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:read'],
          fineGrainedPolicy: 'allow'
        })
      )
      .use(constrainFineGrainedSessionQuery('session_id')())
      .outputList(subspaceSessionEventPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            type: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by event type(s)'
            }),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session event ID(s)'
            }),
            session_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session ID(s)'
            }),
            session_provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session provider ID(s)'
            }),
            session_connection_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session connection ID(s)'
            }),
            provider_run_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider run ID(s)'
            }),
            session_message_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session message ID(s)'
            }),
            session_error_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session error ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSessionEventService.list({
          instance: ctx.instance,
          accessTagSessionIds: getFineGrainedAllowedSessionIds(ctx),
          allowDeleted: false,
          types: normalizeArrayParam(ctx.query.type),
          ids: normalizeArrayParam(ctx.query.id),
          sessionIds: normalizeArrayParam(ctx.query.session_id),
          sessionProviderIds: normalizeArrayParam(ctx.query.session_provider_id),
          sessionConnectionIds: normalizeArrayParam(ctx.query.session_connection_id),
          providerRunIds: normalizeArrayParam(ctx.query.provider_run_id),
          sessionMessageIds: normalizeArrayParam(ctx.query.session_message_id),
          sessionErrorIds: normalizeArrayParam(ctx.query.session_error_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sessionEvent =>
          subspaceSessionEventPresenter.present({ sessionEvent })
        );
      }),

    get: sessionEventGroup
      .get(instancePath('session-events/:sessionEventId', 'sessions.events.get'), {
        name: 'Get session event',
        description: 'Retrieves a specific event from a session.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:read'],
          fineGrainedPolicy: 'allow'
        })
      )
      .output(subspaceSessionEventPresenter)
      .do(async ctx => {
        return subspaceSessionEventPresenter.present({
          sessionEvent: ctx.sessionEvent
        });
      })
  }
);
