import { badRequestError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { subspaceSessionErrorService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import {
  constrainFineGrainedSessionQuery,
  getFineGrainedAllowedSessionIds,
  requireFineGrainedSessionFromResource,
  requireFineGrainedSessionParam
} from '../../../middleware/checkFineGrainedSessionAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { subspaceSessionErrorPresenter } from '../../../presenters';

let sessionErrorGroup = instanceGroup
  .use(async ctx => {
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
  })
  .use(
    requireFineGrainedSessionFromResource(
      ctx =>
        ctx.sessionError?.sessionId ??
        ctx.sessionError?.session_id ??
        ctx.sessionError?.session?.id
    )()
  );

export let sessionErrorController = Controller.create(
  {
    name: 'Session Errors',
    description:
      'Session errors track errors that occurred during a session. This read-only resource provides visibility into issues that happened during provider execution.'
  },
  {
    list: instanceGroup
      .get(instancePath('session-errors', 'sessions.errors.list'), {
        name: 'List all session errors',
        description: 'Returns a paginated list of errors across all sessions.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:read'],
          fineGrainedPolicy: 'allow'
        })
      )
      .use(constrainFineGrainedSessionQuery('session_id')())
      .outputList(subspaceSessionErrorPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            type: v.optional(
              v.union([
                v.enumOf([
                  'message_processing_timeout',
                  'message_processing_provider_error',
                  'message_processing_system_error'
                ]),
                v.array(
                  v.enumOf([
                    'message_processing_timeout',
                    'message_processing_provider_error',
                    'message_processing_system_error'
                  ])
                )
              ]),
              { description: 'Filter by error type(s)' }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session error ID(s)'
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
            session_error_group_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by error group ID(s)'
            }),
            provider_run_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider run ID(s)'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),
            session_message_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session message ID(s)'
            }),
            created_at: dateFilterValidator('session error creation time'),
            updated_at: dateFilterValidator('session error last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSessionErrorService.list({
          instance: ctx.instance,
          accessTagSessionIds: getFineGrainedAllowedSessionIds(ctx),
          allowDeleted: false,
          types: normalizeArrayParam(ctx.query.type),
          ids: normalizeArrayParam(ctx.query.id),
          sessionIds: normalizeArrayParam(ctx.query.session_id),
          sessionProviderIds: normalizeArrayParam(ctx.query.session_provider_id),
          sessionConnectionIds: normalizeArrayParam(ctx.query.session_connection_id),
          sessionErrorGroupIds: normalizeArrayParam(ctx.query.session_error_group_id),
          providerRunIds: normalizeArrayParam(ctx.query.provider_run_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          sessionMessageIds: normalizeArrayParam(ctx.query.session_message_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sessionError =>
          subspaceSessionErrorPresenter.present({ sessionError })
        );
      }),

    get: sessionErrorGroup
      .get(instancePath('session-errors/:sessionErrorId', 'sessions.errors.get'), {
        name: 'Get session error',
        description: 'Retrieves a specific error that occurred in a session.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:read'],
          fineGrainedPolicy: 'allow'
        })
      )
      .use(requireFineGrainedSessionParam('sessionId')())
      .output(subspaceSessionErrorPresenter)
      .do(async ctx => {
        return subspaceSessionErrorPresenter.present({ sessionError: ctx.sessionError });
      })
  }
);
