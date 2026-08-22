import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { callbackEventService } from '@metorial-subspace/module-callback';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { callbackEventPresenter } from '@metorial/presenters';
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

  let callbackEvent = await callbackEventService.getCallbackEvent({
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
        description: 'Returns a paginated list of callback events.',
        confidential: true
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
        let list = await callbackEventService.listCallbackEvents({
          instance: ctx.instance,
          callbackId: ctx.callback.id,
          input: {
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
      .get(
        instancePath('callbacks/:callbackId/events/:callbackEventId', 'callbacks.events.get'),
        {
          name: 'Get callback event',
          description: 'Retrieves a specific callback event.',
          confidential: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .output(callbackEventPresenter)
      .do(async ctx => callbackEventPresenter.present({ callbackEvent: ctx.callbackEvent }))
  }
);
