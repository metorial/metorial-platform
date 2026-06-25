import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceProviderSpecificationChangeNotificationService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { providerSpecificationChangeNotificationPresenter } from '../../../presenters';
import { getRequiredParam, notificationTargetValidator, stringOrArray } from './_shared';

let providerSpecificationChangeNotificationGroup = instanceGroup.use(async ctx => {
  let notification = await subspaceProviderSpecificationChangeNotificationService.get({
    instance: ctx.instance,
    notificationId: getRequiredParam(ctx.params, 'notificationId')
  });

  return { notification };
});

export let providerSpecificationChangeNotificationController = Controller.create(
  {
    name: 'Provider Specification Change Notifications',
    description:
      'Provider specification change notifications describe provider schema changes.'
  },
  {
    list: instanceGroup
      .get(
        instancePath(
          'provider-specification-change-notifications',
          'providerSpecificationChangeNotifications.list'
        ),
        {
          name: 'List provider specification change notifications',
          description:
            'Returns a paginated list of provider specification change notifications for this instance.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.specification:read'] }))
      .outputList(providerSpecificationChangeNotificationPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(stringOrArray()),
            target: v.optional(
              v.union([notificationTargetValidator, v.array(notificationTargetValidator)])
            ),
            provider_id: v.optional(stringOrArray()),
            provider_version_id: v.optional(stringOrArray()),
            provider_specification_id: v.optional(stringOrArray()),
            created_at: dateFilterValidator('provider specification change notification time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderSpecificationChangeNotificationService.list({
          instance: ctx.instance,
          ids: normalizeArrayParam(ctx.query.id),
          targets: normalizeArrayParam(ctx.query.target),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerVersionIds: normalizeArrayParam(ctx.query.provider_version_id),
          providerSpecificationIds: normalizeArrayParam(ctx.query.provider_specification_id),
          createdAt: ctx.query.created_at
        });

        return Paginator.present(await paginator.run(ctx.query), notification =>
          providerSpecificationChangeNotificationPresenter.present({ notification })
        );
      }),

    get: providerSpecificationChangeNotificationGroup
      .get(
        instancePath(
          'provider-specification-change-notifications/:notificationId',
          'providerSpecificationChangeNotifications.get'
        ),
        {
          name: 'Get provider specification change notification',
          description: 'Retrieves a provider specification change notification by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.specification:read'] }))
      .output(providerSpecificationChangeNotificationPresenter)
      .do(async ctx =>
        providerSpecificationChangeNotificationPresenter.present({
          notification: ctx.notification
        })
      )
  }
);
