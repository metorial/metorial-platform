import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { callbackInstanceService } from '@metorial-subspace/module-callback';
import { callbackInstancePresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { callbackStatusValidator, getRequiredParam, stringOrArray } from './_shared';

export let callbackInstanceGroup = instanceGroup.use(async ctx => {
  let callbackInstance = await callbackInstanceService.getCallbackInstanceById({
    instance: ctx.instance,
    callbackInstanceId: getRequiredParam(ctx.params, 'callbackInstanceId'),
    allowDeleted: false
  });

  return { callbackInstance };
});

export let callbackInstanceController = Controller.create(
  {
    name: 'Callback Instances',
    description:
      'A callback instance is a callback as it applies to one integration instance provider. Metorial reconciles one for every matching integration instance, so these are read-only.'
  },
  {
    list: instanceGroup
      .get(instancePath('callback-instances', 'callbackInstances.list'), {
        name: 'List callback instances',
        description: 'Returns a paginated list of callback instances.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .outputList(callbackInstancePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(stringOrArray(), {
              description: 'Only return callback instances with one of these IDs.'
            }),
            callback_id: v.optional(stringOrArray(), {
              description: 'Only return instances of one of these callbacks.'
            }),
            integration_id: v.optional(stringOrArray(), {
              description: 'Only return instances of callbacks belonging to one of these integrations.'
            }),
            integration_instance_id: v.optional(stringOrArray(), {
              description: 'Only return instances listening for one of these integration instances.'
            }),
            integration_instance_provider_id: v.optional(stringOrArray(), {
              description:
                'Only return instances registered on one of these integration instance providers.'
            }),
            status: v.optional(
              v.union([callbackStatusValidator, v.array(callbackStatusValidator)]),
              {
                description:
                  'Only return callback instances with one of these statuses. `deleted` instances are never listed.'
              }
            ),
            search: v.optional(v.string(), {
              description: 'Match a callback instance by its exact ID'
            }),
            created_at: dateFilterValidator('callback instance creation time'),
            updated_at: dateFilterValidator('callback instance last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await callbackInstanceService.listCallbackInstances({
          instance: ctx.instance,
          allowDeleted: false,
          ids: normalizeArrayParam(ctx.query.id),
          callbackIds: normalizeArrayParam(ctx.query.callback_id),
          integrationIds: normalizeArrayParam(ctx.query.integration_id),
          integrationInstanceIds: normalizeArrayParam(ctx.query.integration_instance_id),
          integrationInstanceProviderIds: normalizeArrayParam(
            ctx.query.integration_instance_provider_id
          ),
          status: normalizeArrayParam(ctx.query.status),
          search: ctx.query.search,
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        return Paginator.present(await paginator.run(ctx.query), callbackInstance =>
          callbackInstancePresenter.present({ callbackInstance })
        );
      }),

    get: callbackInstanceGroup
      .get(instancePath('callback-instances/:callbackInstanceId', 'callbackInstances.get'), {
        name: 'Get callback instance',
        description: 'Retrieves a callback instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .output(callbackInstancePresenter)
      .do(async ctx =>
        callbackInstancePresenter.present({ callbackInstance: ctx.callbackInstance })
      )
  }
);
