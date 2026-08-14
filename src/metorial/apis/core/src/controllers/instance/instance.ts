import { Controller } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { instancePresenter } from '@metorial/presenters';

export let instanceController = Controller.create(
  {
    name: 'Instance',
    description:
      'An instance is an isolated environment within a Metorial project. Instances are created via the dashboard (since API keys are scoped to instances). Common setups include production, staging, and development instances.',
    hideInDocs: true
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
