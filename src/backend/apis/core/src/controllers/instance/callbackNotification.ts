import { callbackNotificationService } from '@metorial/module-callbacks';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { callbackNotificationPresenter } from '../../presenters';

export let callbackNotificationGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.notificationId) throw new Error('notificationId is required');

  let callbackNotification = await callbackNotificationService.getCallbackNotificationById({
    notificationId: ctx.params.notificationId,
    instance: ctx.instance
  });

  return { callbackNotification };
});

export let callbackNotificationController = Controller.create(
  {
    name: 'Callback Notifications',
    description:
      'Represents callbacks that you have uploaded to Metorial. Callbacks can be linked to various resources based on their purpose. Metorial can also automatically extract callbacks for you, for example for data exports.'
  },
  {
    list: instanceGroup
      .get(instancePath('callbacks-notifications', 'callbacks.notifications.list'), {
        name: 'List callback notifications',
        description:
          'Returns a paginated list of callback notifications for a specific callback.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .use(hasFlags(['callbacks-enabled', 'paid-callbacks']))
      .outputList(callbackNotificationPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            callback_ids: v.optional(v.union([v.string(), v.array(v.string())])),
            event_ids: v.optional(v.union([v.string(), v.array(v.string())])),
            destination_ids: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await callbackNotificationService.listCallbackNotifications({
          instance: ctx.instance,
          callbackIds: normalizeArrayParam(ctx.query.callback_ids),
          eventIds: normalizeArrayParam(ctx.query.event_ids),
          destinationIds: normalizeArrayParam(ctx.query.destination_ids)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, callbackNotification =>
          callbackNotificationPresenter.present({ callbackNotification })
        );
      }),

    get: callbackNotificationGroup
      .get(
        instancePath('callbacks-notifications/:notificationId', 'callbacks.notifications.get'),
        {
          name: 'Get callback notification by ID',
          description: 'Retrieves details for a specific callback by its ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .use(hasFlags(['callbacks-enabled', 'paid-callbacks']))
      .output(callbackNotificationPresenter)
      .do(async ctx => {
        return callbackNotificationPresenter.present({
          callbackNotification: ctx.callbackNotification
        });
      })
  }
);
