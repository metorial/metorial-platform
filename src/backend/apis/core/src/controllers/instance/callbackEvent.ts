import { callbackEventService } from '@metorial/module-callbacks';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { callbackEventPresenter } from '../../presenters';
import { callbackGroup } from './callback';

export let callbackEventGroup = callbackGroup.use(async ctx => {
  if (!ctx.params.eventId) throw new Error('eventId is required');

  let callbackEvent = await callbackEventService.getCallbackEventById({
    eventId: ctx.params.eventId,
    callback: ctx.callback
  });

  return { callbackEvent };
});

export let callbackEventController = Controller.create(
  {
    name: 'Callback Events',
    description:
      'Represents callbacks that you have uploaded to Metorial. Callbacks can be linked to various resources based on their purpose. Metorial can also automatically extract callbacks for you, for example for data exports.'
  },
  {
    list: callbackGroup
      .get(instancePath('callbacks/:callbackId/events', 'callbacks.events.list'), {
        name: 'List callback events',
        description: 'Returns a paginated list of callback events for a specific callback.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .outputList(callbackEventPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await callbackEventService.listCallbackEvents({
          callback: ctx.callback
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, callbackEvent =>
          callbackEventPresenter.present({ callbackEvent })
        );
      }),

    get: callbackEventGroup
      .get(instancePath('callbacks/:callbackId/events/:eventId', 'callbacks.events.get'), {
        name: 'Get callback event by ID',
        description: 'Retrieves details for a specific callback by its ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .output(callbackEventPresenter)
      .do(async ctx => {
        return callbackEventPresenter.present({ callbackEvent: ctx.callbackEvent });
      })
  }
);
