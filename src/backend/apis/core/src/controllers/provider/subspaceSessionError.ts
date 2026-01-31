import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceSessionErrorService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instancePath } from '../../middleware/instanceGroup';
import { subspaceSessionErrorPresenter } from '../../presenters';
import { SubspaceSessionError } from '../../presenters/types';
import { subspaceSessionGroup } from './subspaceSession';

export let subspaceSessionErrorGroup = subspaceSessionGroup.use(async ctx => {
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
    list: subspaceSessionGroup
      .get(instancePath('sessions/:sessionId/errors', 'sessions.errors.list'), {
        name: 'List session errors',
        description: 'Returns a paginated list of errors that occurred in a session.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .use(hasFlags(['paid-provider-api']))
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
          sessionId: ctx.session.id,
          sessionErrorGroupIds: normalizeArrayParam(ctx.query.session_error_group_id),
          providerRunIds: normalizeArrayParam(ctx.query.provider_run_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sessionError =>
          subspaceSessionErrorPresenter.present({
            sessionError: sessionError as SubspaceSessionError
          })
        );
      }),

    get: subspaceSessionErrorGroup
      .get(instancePath('sessions/:sessionId/errors/:sessionErrorId', 'sessions.errors.get'), {
        name: 'Get session error',
        description: 'Retrieves a specific error that occurred in a session.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .use(hasFlags(['paid-provider-api']))
      .output(subspaceSessionErrorPresenter)
      .do(async ctx => {
        return subspaceSessionErrorPresenter.present({ sessionError: ctx.sessionError });
      })
  }
);
