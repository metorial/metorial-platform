import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceSessionErrorService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { subspaceSessionErrorPresenter } from '../../presenters';

export let subspaceSessionErrorGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.sessionErrorId) {
    throw new ServiceError(
      badRequestError({
        message: 'sessionErrorId is required',
        description: 'The sessionErrorId path parameter is required.'
      })
    );
  }

  let sessionError = await subspaceSessionErrorService.get({
    instance: ctx.instance,
    sessionErrorId: ctx.params.sessionErrorId
  });

  return { sessionError };
});

export let subspaceSessionErrorController = Controller.create(
  {
    name: 'Session Errors',
    description:
      'Session errors track errors that occurred during a session. This read-only resource provides visibility into issues that happened during provider execution.'
  },
  {
    listAll: instanceGroup
      .get(instancePath('session-errors', 'sessionErrors.list'), {
        name: 'List all session errors',
        description: 'Returns a paginated list of errors across all sessions.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(subspaceSessionErrorPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            type: v.optional(v.string(), { description: 'Filter by error type' }),
            session_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session ID(s)'
            }),
            session_error_group_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by error group ID(s)'
            }),
            provider_run_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider run ID(s)'
            })

            //             types: ("message_processing_timeout" | "message_processing_provider_error" | "message_processing_system_error")[] | undefined;
            // ids: string[] | undefined;
            // sessionIds: string[] | undefined;
            // sessionProviderIds: string[] | undefined;
            // sessionConnectionIds: string[] | undefined;
            // providerRunIds: string[] | undefined;
            // providerIds: string[] | undefined;
            // sessionMessageIds: string[] | undefined;
            // sessionErrorGroupIds: string[] | undefined;
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSessionErrorService.list({
          instance: ctx.instance,
          sessionIds: normalizeArrayParam(ctx.query.session_id),
          sessionErrorGroupIds: normalizeArrayParam(ctx.query.session_error_group_id),
          providerRunIds: normalizeArrayParam(ctx.query.provider_run_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sessionError =>
          subspaceSessionErrorPresenter.present({ sessionError })
        );
      }),

    list: instanceGroup
      .get(instancePath('sessions/:sessionId/errors', 'sessions.errors.list'), {
        name: 'List session errors',
        description: 'Returns a paginated list of errors that occurred in a session.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(subspaceSessionErrorPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            type: v.optional(v.string(), { description: 'Filter by error type' }),
            session_error_group_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by error group ID(s)'
            }),
            provider_run_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider run ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSessionErrorService.list({
          instance: ctx.instance,
          sessionIds: [ctx.session.id],
          sessionErrorGroupIds: normalizeArrayParam(ctx.query.session_error_group_id),
          providerRunIds: normalizeArrayParam(ctx.query.provider_run_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sessionError =>
          subspaceSessionErrorPresenter.present({ sessionError })
        );
      }),

    get: subspaceSessionErrorGroup
      .get(instancePath('sessions/:sessionId/errors/:sessionErrorId', 'sessions.errors.get'), {
        name: 'Get session error',
        description: 'Retrieves a specific error that occurred in a session.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(subspaceSessionErrorPresenter)
      .do(async ctx => {
        return subspaceSessionErrorPresenter.present({ sessionError: ctx.sessionError });
      })
  }
);
