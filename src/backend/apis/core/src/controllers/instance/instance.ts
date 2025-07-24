import { Controller } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { instancePresenter } from '../../presenters';

export let instanceController = Controller.create(
  {
    name: 'Instance',
    description:
      'Instances are independent environments within Metorial, each with its own configuration and data. Each instance is a port of a Metorial project. You can for example create production, staging, and development instances for your project.'
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
