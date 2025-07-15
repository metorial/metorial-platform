import { Controller } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { instancePresenter } from '../../presenters';

export let instanceController = Controller.create(
  {
    name: 'Instance',
    description: 'Endpoint for retrieving information about a specific instance.'
  },
  {
    get: instanceGroup
      .get(instancePath('instance', 'instance.get'), {
        name: 'Get instance details',
        description: 'Retrieves metadata and configuration details for a specific instance.'
      })
      .use(checkAccess({ possibleScopes: ['organization.instance:read'] }))
      .output(instancePresenter)
      .do(async ctx => instancePresenter.present({ instance: ctx.instance }))
  }
);
