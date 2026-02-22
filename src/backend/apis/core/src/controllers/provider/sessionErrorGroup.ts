import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceSessionErrorGroupService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { subspaceSessionErrorGroupPresenter } from '../../presenters';

let sessionErrorGroupGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.sessionErrorGroupId) {
    throw new ServiceError(
      badRequestError({
        message: 'sessionErrorGroupId is required',
        description: 'The sessionErrorGroupId path parameter is required.'
      })
    );
  }

  let sessionErrorGroup = await subspaceSessionErrorGroupService.get({
    instance: ctx.instance,
    sessionErrorGroupId: ctx.params.sessionErrorGroupId
  });

  return { sessionErrorGroup };
});

export let sessionErrorGroupController = Controller.create(
  {
    name: 'Session Error Groups',
    description:
      'Session error groups aggregate similar errors that occurred during a session. This read-only resource helps identify patterns in errors.'
  },
  {
    listAll: instanceGroup
      .get(instancePath('session-error-groups', 'sessionErrorGroups.list'), {
        name: 'List all session error groups',
        description: 'Returns a paginated list of error groups across all sessions.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(subspaceSessionErrorGroupPresenter)
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
              description: 'Filter by error group ID(s)'
            }),
            session_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session ID(s)'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSessionErrorGroupService.list({
          instance: ctx.instance,
          allowDeleted: false,
          types: normalizeArrayParam(ctx.query.type),
          ids: normalizeArrayParam(ctx.query.id),
          sessionIds: normalizeArrayParam(ctx.query.session_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sessionErrorGroup =>
          subspaceSessionErrorGroupPresenter.present({ sessionErrorGroup })
        );
      }),

    getOne: instanceGroup
      .get(
        instancePath('session-error-groups/:sessionErrorGroupId', 'sessionErrorGroups.get'),
        {
          name: 'Get session error group',
          description: 'Retrieves a specific error group by ID across all sessions.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(subspaceSessionErrorGroupPresenter)
      .do(async ctx => {
        if (!ctx.params.sessionErrorGroupId) {
          throw new ServiceError(
            badRequestError({
              message: 'sessionErrorGroupId is required',
              description: 'The sessionErrorGroupId path parameter is required.'
            })
          );
        }

        let sessionErrorGroup = await subspaceSessionErrorGroupService.get({
          instance: ctx.instance,
          sessionErrorGroupId: ctx.params.sessionErrorGroupId
        });

        return subspaceSessionErrorGroupPresenter.present({ sessionErrorGroup });
      }),

    list: instanceGroup
      .get(instancePath('sessions/:sessionId/error-groups', 'sessions.errorGroups.list'), {
        name: 'List session error groups',
        description: 'Returns a paginated list of error groups for a session.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(subspaceSessionErrorGroupPresenter)
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
              description: 'Filter by error group ID(s)'
            }),
            session_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session ID(s)'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSessionErrorGroupService.list({
          instance: ctx.instance,
          allowDeleted: false,
          types: normalizeArrayParam(ctx.query.type),
          ids: normalizeArrayParam(ctx.query.id),
          sessionIds: normalizeArrayParam(ctx.query.session_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sessionErrorGroup =>
          subspaceSessionErrorGroupPresenter.present({ sessionErrorGroup })
        );
      }),

    get: sessionErrorGroupGroup
      .get(
        instancePath(
          'sessions/:sessionId/error-groups/:sessionErrorGroupId',
          'sessions.errorGroups.get'
        ),
        {
          name: 'Get session error group',
          description: 'Retrieves a specific error group for a session.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(subspaceSessionErrorGroupPresenter)
      .do(async ctx => {
        return subspaceSessionErrorGroupPresenter.present({
          sessionErrorGroup: ctx.sessionErrorGroup
        });
      })
  }
);
