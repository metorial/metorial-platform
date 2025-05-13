import { Controller } from '@metorial/rest';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { instancePresenter } from '../../presenters';

export let instanceController = Controller.create(
  {
    name: 'Instance',
    description: 'Read and write instance information'
  },
  {
    get: instanceGroup
      .get(instancePath('instance', 'instance.get'), {
        name: 'Get  instance',
        description: 'Get the information of a specific  instance'
      })
      .output(instancePresenter)
      .do(async ctx => instancePresenter.present({ instance: ctx.instance }))
  }
);
