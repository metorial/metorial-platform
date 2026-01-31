import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceSessionErrorGroupService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instancePath } from '../../middleware/instanceGroup';
import { subspaceSessionErrorGroupPresenter } from '../../presenters';
import { SubspaceSessionErrorGroup } from '../../presenters/types';
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
    list: subspaceSessionGroup
      .get(instancePath('sessions/:sessionId/error-groups', 'sessions.errorGroups.list'), {
        name: 'List session error groups',
        description: 'Returns a paginated list of error groups for a session.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .use(hasFlags(['paid-provider-api']))
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
      .use(hasFlags(['paid-provider-api']))
      .output(subspaceSessionErrorGroupPresenter)
      .do(async ctx => {
        return subspaceSessionErrorGroupPresenter.present({
          sessionErrorGroup: ctx.sessionErrorGroup
        });
      })
  }
);
