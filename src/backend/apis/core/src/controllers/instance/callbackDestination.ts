import { callbackDestinationService } from '@metorial/module-callbacks';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { callbackDestinationPresenter } from '../../presenters';

export let callbackDestinationGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.destinationId) throw new Error('destinationId is required');

  let callbackDestination = await callbackDestinationService.getCallbackDestinationById({
    destinationId: ctx.params.destinationId,
    instance: ctx.instance
  });

  return { callbackDestination };
});

export let callbackDestinationController = Controller.create(
  {
    name: 'Callback Destinations',
    description:
      'Represents callbacks that you have uploaded to Metorial. Callbacks can be linked to various resources based on their purpose. Metorial can also automatically extract callbacks for you, for example for data exports.'
  },
  {
    list: instanceGroup
      .get(instancePath('callbacks-destinations', 'callbacks.destinations.list'), {
        name: 'List callback destinations',
        description:
          'Returns a paginated list of callback destinations for a specific callback.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .use(hasFlags(['callbacks-enabled', 'paid-callbacks']))
      .outputList(callbackDestinationPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            callback_ids: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await callbackDestinationService.listCallbackDestinations({
          instance: ctx.instance,
          callbackIds: normalizeArrayParam(ctx.query.callback_ids)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, callbackDestination =>
          callbackDestinationPresenter.present({ callbackDestination })
        );
      }),

    get: callbackDestinationGroup
      .get(
        instancePath('callbacks-destinations/:destinationId', 'callbacks.destinations.get'),
        {
          name: 'Get callback destination by ID',
          description: 'Retrieves details for a specific callback by its ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .use(hasFlags(['callbacks-enabled', 'paid-callbacks']))
      .output(callbackDestinationPresenter)
      .do(async ctx => {
        return callbackDestinationPresenter.present({
          callbackDestination: ctx.callbackDestination
        });
      }),

    create: instanceGroup
      .post(instancePath('callbacks-destinations', 'callbacks.destinations.create'), {
        name: 'Create callback destination',
        description: 'Creates a new callback destination for the instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .use(hasFlags(['callbacks-enabled', 'paid-callbacks']))
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          url: v.string(),
          callbacks: v.union([
            v.object({
              type: v.literal('all')
            }),
            v.object({
              type: v.literal('selected'),
              callback_ids: v.array(v.string())
            })
          ])
        })
      )
      .output(callbackDestinationPresenter)
      .do(async ctx => {
        let callbackDestination = await callbackDestinationService.createCallbackDestination({
          instance: ctx.instance,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            url: ctx.body.url,
            callbacks:
              ctx.body.callbacks.type === 'all'
                ? { type: 'all' }
                : { type: 'selected', callbackIds: ctx.body.callbacks.callback_ids }
          }
        });

        return callbackDestinationPresenter.present({ callbackDestination });
      }),

    update: callbackDestinationGroup
      .patch(
        instancePath('callbacks-destinations/:destinationId', 'callbacks.destinations.update'),
        {
          name: 'Update callback destination',
          description: 'Updates an existing callback destination for the instance.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .use(hasFlags(['callbacks-enabled', 'paid-callbacks']))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.nullable(v.string()))
        })
      )
      .output(callbackDestinationPresenter)
      .do(async ctx => {
        let callbackDestination = await callbackDestinationService.updateCallbackDestination({
          destination: ctx.callbackDestination,
          input: {
            name: ctx.body.name,
            description: ctx.body.description
          }
        });

        return callbackDestinationPresenter.present({ callbackDestination });
      }),

    delete: callbackDestinationGroup
      .delete(
        instancePath('callbacks-destinations/:destinationId', 'callbacks.destinations.delete'),
        {
          name: 'Delete callback destination',
          description: 'Deletes an existing callback destination for the instance.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .use(hasFlags(['callbacks-enabled', 'paid-callbacks']))
      .output(callbackDestinationPresenter)
      .do(async ctx => {
        let callbackDestination = await callbackDestinationService.deleteCallbackDestination({
          destination: ctx.callbackDestination
        });

        return callbackDestinationPresenter.present({ callbackDestination });
      })
  }
);
