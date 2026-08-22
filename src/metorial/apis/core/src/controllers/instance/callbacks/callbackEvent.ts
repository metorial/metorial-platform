import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { callbackEventService } from '@metorial-subspace/module-callback';
import { callbackEventPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';

let callbackEventGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.callbackEventId) {
    throw new ServiceError(
      badRequestError({
        message: 'callbackEventId is required',
        description: 'The callbackEventId path parameter is required.'
      })
    );
  }
  let callbackEvent = await callbackEventService.getCallbackEventForScope({
    instance: ctx.instance,
    callbackEventId: ctx.params.callbackEventId
  });
  return { callbackEvent };
});

export let callbackEventController = Controller.create(
  {
    name: 'Callback Events',
    description: 'Read inbound callback trigger events across an instance.'
  },
  {
    list: instanceGroup
      .get(instancePath('callback-events', 'callbacks.events.list'), {
        name: 'List callback events',
        description: 'Returns a paginated list of callback events.',
        confidential: true
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .outputList(callbackEventPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            callback_id: v.optional(v.union([v.string(), v.array(v.string())])),
            callback_instance_id: v.optional(v.union([v.string(), v.array(v.string())])),
            type: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let list = await callbackEventService.listCallbackEventsForScope({
          instance: ctx.instance,
          input: {
            callbackIds: normalizeArrayParam(ctx.query.callback_id),
            callbackInstanceIds: normalizeArrayParam(ctx.query.callback_instance_id),
            eventTypes: normalizeArrayParam(ctx.query.type),
            limit: ctx.query.limit,
            after: ctx.query.after,
            before: ctx.query.before,
            cursor: ctx.query.cursor,
            order: ctx.query.order
          }
        });
        return Paginator.present(
          {
            items: list.items,
            pagination: {
              hasNextPage: list.pagination.has_more_after,
              hasPreviousPage: list.pagination.has_more_before
            }
          },
          callbackEvent => callbackEventPresenter.present({ callbackEvent })
        );
      }),

    get: callbackEventGroup
      .get(instancePath('callback-events/:callbackEventId', 'callbacks.events.get'), {
        name: 'Get callback event',
        description: 'Retrieves a specific callback event.',
        confidential: true
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .output(callbackEventPresenter)
      .do(async ctx => callbackEventPresenter.present({ callbackEvent: ctx.callbackEvent }))
  }
);
