import { callbackEventService } from '@metorial/module-callbacks';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { callbackEventPresenter } from '../../presenters';

export let callbackEventGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.eventId) throw new Error('eventId is required');

  let callbackEvent = await callbackEventService.getCallbackEventById({
    eventId: ctx.params.eventId,
    instance: ctx.instance
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
    list: instanceGroup
      .get(instancePath('callbacks-events', 'callbacks.events.list'), {
        name: 'List callback events',
        description: 'Returns a paginated list of callback events for a specific callback.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .outputList(callbackEventPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            callback_ids: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await callbackEventService.listCallbackEvents({
          instance: ctx.instance,
          callbackIds: normalizeArrayParam(ctx.query.callback_ids)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, callbackEvent =>
          callbackEventPresenter.present({ callbackEvent })
        );
      }),

    get: callbackEventGroup
      .get(instancePath('callbacks-events/:eventId', 'callbacks.events.get'), {
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
