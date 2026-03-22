import { notFoundError, ServiceError } from '@lowerdeck/error';
import { instanceService } from '@metorial/module-organization';
import { Controller, Path } from '@metorial/rest';
import { apiGroup } from '../../middleware/apiGroup';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceListPresenter, instancePresenter } from '../../presenters';

let instancesGroup = apiGroup.use(async ctx => {
  if (ctx.auth.type == 'fine_grained') {
    return {
      instances: [
        {
          ...ctx.auth.restrictions.instance,
          organization: ctx.auth.restrictions.organization
        }
      ]
    };
  }

  if (ctx.auth.type == 'machine') {
    if (ctx.auth.restrictions.type == 'instance') {
      return {
        instances: [
          {
            ...ctx.auth.restrictions.instance,
            organization: ctx.auth.restrictions.organization
          }
        ]
      };
    }

    if (ctx.auth.restrictions.type == 'organization') {
      let instances = await instanceService.getManyInstancesForOrganization({
        organization: ctx.auth.restrictions.organization
      });
      return { instances };
    }
  }

  if (ctx.auth.type == 'user') {
    let instances = await instanceService.getManyInstancesForUser({
      user: ctx.auth.user
    });
    return { instances };
  }

  return { instances: [] };
});

export let instancesController = Controller.create(
  {
    name: 'Instances',
    description:
      'Endpoints for listing and retrieving instances. An instance is an isolated environment within a Metorial project. Instances are created via the dashboard (since API keys are scoped to instances). Common setups include production, staging, and development instances.'
  },
  {
    get: instancesGroup
      .get(Path('instances/:instanceId', 'instances.get'), {
        name: 'Get instance details',
        description: 'Retrieves metadata and configuration details for a specific instance.'
      })
      .use(checkAccess({ possibleScopes: ['organization.instance:read'] }))
      .output(instancePresenter)
      .do(async ctx => {
        let instance = ctx.instances.find(
          i => i.id === ctx.params.instanceId || i.slug === ctx.params.instanceId
        );
        if (!instance) throw new ServiceError(notFoundError('instance'));

        return instancePresenter.present({ instance });
      }),

    list: instancesGroup
      .get(Path('instances', 'instances.list'), {
        name: 'List instances',
        description:
          'Lists all instances within the organization that the authenticated actor has access to.',
        hideInDocs: true
      })
      .use(checkAccess({ possibleScopes: ['organization.instance:read'] }))
      .output(instanceListPresenter)
      .do(async ctx => instanceListPresenter.present({ instances: ctx.instances }))
  }
);
