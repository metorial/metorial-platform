import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceCallbackEventService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { callbackGroup } from './callback';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { callbackEventPresenter } from '../../presenters';

let callbackEventGroup = callbackGroup.use(async ctx => {
  if (!ctx.params.callbackEventId) {
    throw new ServiceError(
      badRequestError({
        message: 'callbackEventId is required',
        description: 'The callbackEventId path parameter is required.'
      })
    );
  }

  let callbackEvent = await subspaceCallbackEventService.get({
    instance: ctx.instance,
    callbackId: ctx.callback.id,
    slateTriggerEventId: ctx.params.callbackEventId
  });

  return { callbackEvent };
});

export let callbackEventController = Controller.create(
  {
    name: 'Callback Events',
    description: 'Read callback trigger events.'
  },
  {
    list: callbackGroup
      .get(instancePath('callbacks/:callbackId/events', 'callbacks.events.list'), {
        name: 'List callback events',
        description: 'Returns a paginated list of callback events.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .outputList(callbackEventPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            type: v.optional(v.union([v.string(), v.array(v.string())])),
            source_id: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceCallbackEventService.list({
          instance: ctx.instance,
          callbackId: ctx.callback.id,
          slateTriggerEventIds: normalizeArrayParam(ctx.query.id),
          types: normalizeArrayParam(ctx.query.type),
          sourceIds: normalizeArrayParam(ctx.query.source_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, callbackEvent =>
          callbackEventPresenter.present({ callbackEvent })
        );
      }),

    get: callbackEventGroup
      .get(
        instancePath('callbacks/:callbackId/events/:callbackEventId', 'callbacks.events.get'),
        {
          name: 'Get callback event',
          description: 'Retrieves a specific callback event.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .output(callbackEventPresenter)
      .do(async ctx => callbackEventPresenter.present({ callbackEvent: ctx.callbackEvent }))
  }
);
