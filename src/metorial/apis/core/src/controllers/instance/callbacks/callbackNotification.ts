import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { callbackDeliveryService } from '@metorial-subspace/module-callback';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { callbackNotificationPresenter } from '@metorial/presenters';
import { callbackGroup } from './callback';

let callbackNotificationGroup = callbackGroup.use(async ctx => {
  if (!ctx.params.callbackNotificationId) {
    throw new ServiceError(
      badRequestError({
        message: 'callbackNotificationId is required',
        description: 'The callbackNotificationId path parameter is required.'
      })
    );
  }

  let callbackNotification = await callbackDeliveryService.getCallbackDelivery({
    instance: ctx.instance,
    callbackId: ctx.callback.id,
    eventDeliveryIntentId: ctx.params.callbackNotificationId
  });

  return { callbackNotification };
});

export let callbackNotificationController = Controller.create(
  {
    name: 'Callback Notifications',
    description: 'Read callback notification deliveries.',
    hideInDocs: true
  },
  {
    list: callbackGroup
      .get(
        instancePath('callbacks/:callbackId/notifications', 'callbacks.notifications.list'),
        {
          name: 'List callback notifications',
          description: 'Returns a paginated list of callback notifications.',
          confidential: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .outputList(callbackNotificationPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            destination_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by callback destination ID(s)'
            }),
            status: v.optional(
              v.union([
                v.enumOf(['pending', 'failed', 'delivered', 'retrying']),
                v.array(v.enumOf(['pending', 'failed', 'delivered', 'retrying']))
              ]),
              {
                description: 'Filter by callback notification delivery status'
              }
            )
          })
        )
      )
      .do(async ctx => {
        let list = await callbackDeliveryService.listCallbackDeliveries({
          instance: ctx.instance,
          callbackId: ctx.callback.id,
          input: {
            destinationIds: normalizeArrayParam(ctx.query.destination_id),
            status: normalizeArrayParam(ctx.query.status) as
              | ('pending' | 'failed' | 'delivered' | 'retrying')[]
              | undefined,
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
          callbackNotification =>
            callbackNotificationPresenter.present({ callbackNotification })
        );
      }),

    get: callbackNotificationGroup
      .get(
        instancePath(
          'callbacks/:callbackId/notifications/:callbackNotificationId',
          'callbacks.notifications.get'
        ),
        {
          name: 'Get callback notification',
          description: 'Retrieves a specific callback notification.',
          confidential: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .output(callbackNotificationPresenter)
      .do(async ctx =>
        callbackNotificationPresenter.present({
          callbackNotification: ctx.callbackNotification
        })
      )
  }
);
