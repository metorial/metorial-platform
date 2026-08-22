import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { callbackService } from '@metorial-subspace/module-callback';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { callbackPresenter } from '@metorial/presenters';

export let callbackGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.callbackId) {
    throw new ServiceError(
      badRequestError({
        message: 'callbackId is required',
        description: 'The callbackId path parameter is required.'
      })
    );
  }

  let callback = await callbackService.getCallbackById({
    instance: ctx.instance,
    callbackId: ctx.params.callbackId,
    allowDeleted: false
  });

  return { callback };
});

export let callbackController = Controller.create(
  {
    name: 'Callbacks',
    description: 'Manage webhook-style callbacks backed by subspace trigger receivers.'
  },
  {
    list: instanceGroup
      .get(instancePath('callbacks', 'callbacks.list'), {
        name: 'List callbacks',
        description: 'Returns a paginated list of callbacks.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .outputList(callbackPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by callback ID(s)'
            }),
            integration_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by integration ID(s)'
            }),
            integration_provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by integration provider ID(s)'
            }),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ]),
              {
                description: 'Filter by callback lifecycle status'
              }
            ),
            created_at: dateFilterValidator('callback creation time'),
            updated_at: dateFilterValidator('callback last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await callbackService.listCallbacks({
          instance: ctx.instance,
          allowDeleted: false,
          ids: normalizeArrayParam(ctx.query.id),
          integrationIds: normalizeArrayParam(ctx.query.integration_id),
          integrationProviderIds: normalizeArrayParam(ctx.query.integration_provider_id),
          status: normalizeArrayParam(ctx.query.status),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, callback =>
          callbackPresenter.present({
            callback
          })
        );
      }),

    get: callbackGroup
      .get(instancePath('callbacks/:callbackId', 'callbacks.get'), {
        name: 'Get callback',
        description: 'Retrieves a specific callback by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .output(callbackPresenter)
      .do(async ctx => callbackPresenter.present({ callback: ctx.callback }))
  }
);
