import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceSessionErrorGroupService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { subspaceSessionErrorGroupPresenter } from '../../presenters';
import { SubspaceSessionErrorGroup } from '../../presenters/types';
import { instanceGroup } from '../../middleware/instanceGroup';
import { subspaceSessionGroup } from './subspaceSession';

export let subspaceSessionErrorGroupGroup = subspaceSessionGroup.use(async ctx => {
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

export let subspaceSessionErrorGroupController = Controller.create(
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
            type: v.optional(v.string(), { description: 'Filter by error type' }),
            session_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSessionErrorGroupService.list({
          instance: ctx.instance,
          sessionIds: normalizeArrayParam(ctx.query.session_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sessionErrorGroup =>
          subspaceSessionErrorGroupPresenter.present({
            sessionErrorGroup: sessionErrorGroup as SubspaceSessionErrorGroup
          })
        );
      }),

    getOne: instanceGroup
      .get(
        instancePath(
          'session-error-groups/:sessionErrorGroupId',
          'sessionErrorGroups.get'
        ),
        {
          name: 'Get session error group',
          description:
            'Retrieves a specific error group by ID across all sessions.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(subspaceSessionErrorGroupPresenter)
      .do(async ctx => {
        if (!ctx.params.sessionErrorGroupId) {
          throw new ServiceError(
            badRequestError({
              message: 'sessionErrorGroupId is required',
              description:
                'The sessionErrorGroupId path parameter is required.'
            })
          );
        }

        let sessionErrorGroup = await subspaceSessionErrorGroupService.get({
          instance: ctx.instance,
          sessionErrorGroupId: ctx.params.sessionErrorGroupId
        });

        return subspaceSessionErrorGroupPresenter.present({
          sessionErrorGroup: sessionErrorGroup as SubspaceSessionErrorGroup
        });
      }),

    list: subspaceSessionGroup
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
            type: v.optional(v.string(), { description: 'Filter by error type' })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSessionErrorGroupService.list({
          instance: ctx.instance,
          sessionId: ctx.session.id
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sessionErrorGroup =>
          subspaceSessionErrorGroupPresenter.present({
            sessionErrorGroup: sessionErrorGroup as SubspaceSessionErrorGroup
          })
        );
      }),

    get: subspaceSessionErrorGroupGroup
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
