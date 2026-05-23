import { badRequestError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { subspaceCallbackEventService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { callbackEventPresenter } from '../../../presenters';
import { callbackGroup } from './callback';

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
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by callback event ID(s)'
            }),
            type: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by event type(s)'
            }),
            source_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider source ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceCallbackEventService.list({
          instance: ctx.instance,
          callbackId: ctx.callback.id,
          eventTypes: normalizeArrayParam(ctx.query.type)
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
