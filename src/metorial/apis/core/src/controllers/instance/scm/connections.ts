import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  scmConnectionService,
  scmConnectionSetupSessionService
} from '@metorial-subspace/module-custom-provider';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { scmConnectionPresenter, scmConnectionSetupPresenter } from '../../../presenters';

let scmConnectionGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.scmConnectionId) {
    throw new ServiceError(
      badRequestError({
        message: 'scmConnectionId is required',
        description: 'The scmConnectionId path parameter is required.'
      })
    );
  }

  let scmConnection = await scmConnectionService.getScmConnectionById({
    instance: ctx.instance,
    scmConnectionId: ctx.params.scmConnectionId
  });

  return { scmConnection };
});

export let scmConnectionsController = Controller.create(
  {
    name: 'SCM Connections',
    description: 'Manage source control connections for an instance.'
  },
  {
    list: instanceGroup
      .get(instancePath('scm/connections', 'scm.connections.list'), {
        name: 'List SCM connections',
        description: 'Returns a paginated list of SCM connections.'
      })
      .use(checkAccess({ possibleScopes: ['instance.scm.installation:read'] }))
      .outputList(scmConnectionPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let list = await scmConnectionService.listScmConnections({
          instance: ctx.instance,
          organizationActor: ctx.actor!,
          ...ctx.query
        });

        return Paginator.present(
          {
            items: list.items,
            pagination: {
              hasNextPage: list.pagination.has_more_after,
              hasPreviousPage: list.pagination.has_more_before
            }
          },
          scmConnection =>
            scmConnectionPresenter.present({
              scmConnection
            })
        );
      }),

    get: scmConnectionGroup
      .get(instancePath('scm/connections/:scmConnectionId', 'scm.connections.get'), {
        name: 'Get SCM connection',
        description: 'Retrieves a specific SCM connection by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.scm.installation:read'] }))
      .output(scmConnectionPresenter)
      .do(async ctx => {
        return scmConnectionPresenter.present({
          scmConnection: ctx.scmConnection
        });
      }),

    create: instanceGroup
      .post(instancePath('scm/connections', 'scm.connections.create'), {
        name: 'Create SCM connection',
        description: 'Initiates an SCM connection setup session.'
      })
      .use(checkAccess({ possibleScopes: ['instance.scm.installation:write'] }))
      .body(
        'default',
        v.object({
          redirect_url: v.optional(
            v.string({ description: 'URL to redirect after authorization' })
          )
        })
      )
      .output(scmConnectionSetupPresenter)
      .do(async ctx => {
        let scmConnectionSetup = await scmConnectionSetupSessionService.createScmConnectionSetupSession(
          {
            instance: ctx.instance,
            redirectUrl: ctx.body.redirect_url,
            organizationActor: ctx.actor!
          }
        );

        return scmConnectionSetupPresenter.present({
          scmConnectionSetup
        });
      })
  }
);
