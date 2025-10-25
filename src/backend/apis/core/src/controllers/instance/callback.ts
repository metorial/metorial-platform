import { callbackService } from '@metorial/module-callbacks';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { callbackPresenter } from '../../presenters';

export let callbackGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.callbackId) throw new Error('callbackId is required');

  let callback = await callbackService.getCallbackById({
    callbackId: ctx.params.callbackId,
    instance: ctx.instance
  });

  return { callback };
});

export let callbackController = Controller.create(
  {
    name: 'Callbacks',
    description:
      'Callbacks allow you to receive webhooks from MCP servers on Metorial. Callbacks are automatically created when you create a callback-enabled server deployment.'
  },
  {
    list: instanceGroup
      .get(instancePath('callbacks', 'callbacks.list'), {
        name: 'List callbacks',
        description: 'Returns a paginated list of callbacks.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .use(hasFlags(['callbacks-enabled', 'paid-callbacks']))
      .outputList(callbackPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await callbackService.listCallbacks({
          instance: ctx.instance
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, callback => callbackPresenter.present({ callback }));
      }),

    get: callbackGroup
      .get(instancePath('callbacks/:callbackId', 'callbacks.get'), {
        name: 'Get callback by ID',
        description: 'Retrieves details for a specific callback by its ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .use(hasFlags(['callbacks-enabled', 'paid-callbacks']))
      .output(callbackPresenter)
      .do(async ctx => {
        return callbackPresenter.present({ callback: ctx.callback });
      })
  }
);
