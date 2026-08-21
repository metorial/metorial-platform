import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { callbackDestinationService } from '@metorial-subspace/module-callback';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { isDashboardGroup } from '../../../middleware/isDashboard';
import {
  callbackDestinationPresenter,
  callbackDestinationSigningSecretPresenter
} from '@metorial/presenters';

let callbackDestinationGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.callbackDestinationId) {
    throw new ServiceError(
      badRequestError({
        message: 'callbackDestinationId is required',
        description: 'The callbackDestinationId path parameter is required.'
      })
    );
  }

  let callbackDestination = await callbackDestinationService.getCallbackDestinationById({
    instance: ctx.instance,
    callbackDestinationId: ctx.params.callbackDestinationId
  });
  let enrichedCallbackDestination = await callbackDestinationService.enrichCallbackDestination(
    {
      instance: ctx.instance,
      callbackDestination
    }
  );

  return { callbackDestination: enrichedCallbackDestination };
});

let dashboardCallbackDestinationGroup = instanceGroup
  .use(isDashboardGroup())
  .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
  .use(async ctx => {
    if (!ctx.params.callbackDestinationId) {
      throw new ServiceError(
        badRequestError({
          message: 'callbackDestinationId is required',
          description: 'The callbackDestinationId path parameter is required.'
        })
      );
    }

    let callbackDestination = await callbackDestinationService.getCallbackDestinationById({
      instance: ctx.instance,
      callbackDestinationId: ctx.params.callbackDestinationId
    });

    return { callbackDestination };
  });

export let callbackDestinationController = Controller.create(
  {
    name: 'Callback Destinations',
    description: 'Manage callback webhook destinations.'
  },
  {
    list: instanceGroup
      .get(instancePath('callback-destinations', 'callbacks.destinations.list'), {
        name: 'List callback destinations',
        description: 'Returns a paginated list of callback destinations.',
        confidential: true
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .outputList(callbackDestinationPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object(
            {
              callback_id: v.optional(v.union([v.string(), v.array(v.string())]), {
                description: 'Only include destinations linked to the callback ID(s).'
              }),
              created_at: dateFilterValidator('callback destination creation time'),
              updated_at: dateFilterValidator('callback destination last update time')
            },
            { description: 'Pagination parameters for listing callback destinations' }
          )
        )
      )
      .do(async ctx => {
        let paginator = await callbackDestinationService.listCallbackDestinations({
          instance: ctx.instance,
          callbackIds: normalizeArrayParam(ctx.query.callback_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);
        let callbackDestinations = await callbackDestinationService.enrichCallbackDestinations(
          {
            instance: ctx.instance,
            callbackDestinations: list.items
          }
        );

        return Paginator.present(
          { ...list, items: callbackDestinations },
          callbackDestination => callbackDestinationPresenter.present({ callbackDestination })
        );
      }),

    get: callbackDestinationGroup
      .get(
        instancePath(
          'callback-destinations/:callbackDestinationId',
          'callbacks.destinations.get'
        ),
        {
          name: 'Get callback destination',
          description: 'Retrieves a specific callback destination.',
          confidential: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .output(callbackDestinationPresenter)
      .do(async ctx =>
        callbackDestinationPresenter.present({ callbackDestination: ctx.callbackDestination })
      ),

    create: instanceGroup
      .post(instancePath('callback-destinations', 'callbacks.destinations.create'), {
        name: 'Create callback destination',
        description: 'Creates a new callback destination.',
        confidential: true
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .body(
        'default',
        v.object({
          name: v.string({
            description: 'Display name for the callback destination',
            examples: ['Primary Webhook Endpoint']
          }),
          description: v.optional(
            v.string({
              description: 'Optional callback destination description',
              examples: ['Primary production webhook receiver']
            })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              description: 'Custom key-value pairs for storing destination metadata',
              examples: [{ region: 'us-east-1', owner: 'integrations-team' }]
            })
          ),
          url: v.string({
            description: 'Webhook URL that should receive callback deliveries',
            examples: ['https://api.example.com/webhooks/metorial']
          })
        })
      )
      .output(callbackDestinationPresenter)
      .do(async ctx => {
        let callbackDestination = await callbackDestinationService.createCallbackDestination({
          instance: ctx.instance,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            url: ctx.body.url
          }
        });
        callbackDestination = await callbackDestinationService.enrichCallbackDestination({
          instance: ctx.instance,
          callbackDestination
        });

        return callbackDestinationPresenter.present({ callbackDestination });
      }),

    update: callbackDestinationGroup
      .patch(
        instancePath(
          'callback-destinations/:callbackDestinationId',
          'callbacks.destinations.update'
        ),
        {
          name: 'Update callback destination',
          description: 'Updates a callback destination.',
          confidential: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(
            v.string({
              description: 'Updated callback destination name',
              examples: ['Secondary Webhook Endpoint']
            })
          ),
          description: v.optional(
            v.string({
              description: 'Updated destination description',
              examples: ['Secondary failover webhook receiver']
            })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              description: 'Updated destination metadata',
              examples: [{ region: 'us-west-2', owner: 'platform-team' }]
            })
          ),
          url: v.optional(
            v.string({
              description: 'Updated webhook URL for callback deliveries',
              examples: ['https://api.example.com/webhooks/metorial/failover']
            })
          )
        })
      )
      .output(callbackDestinationPresenter)
      .do(async ctx => {
        let callbackDestination = await callbackDestinationService.updateCallbackDestination({
          instance: ctx.instance,
          callbackDestination: ctx.callbackDestination,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            url: ctx.body.url
          }
        });
        callbackDestination = await callbackDestinationService.enrichCallbackDestination({
          instance: ctx.instance,
          callbackDestination
        });

        return callbackDestinationPresenter.present({ callbackDestination });
      }),

    rotateSigningSecret: dashboardCallbackDestinationGroup
      .post(
        instancePath(
          'callback-destinations/:callbackDestinationId/security/signing-secret/rotate',
          'callbacks.destinations.rotateSigningSecret'
        ),
        {
          name: 'Rotate callback destination signing secret',
          description:
            'Immediately rotates the outbound callback signing secret and returns it once.',
          confidential: true
        }
      )
      .output(callbackDestinationSigningSecretPresenter)
      .do(async ctx => {
        let callbackDestinationSigningSecret =
          await callbackDestinationService.rotateSigningSecret({
            instance: ctx.instance,
            callbackDestination: ctx.callbackDestination
          });

        return callbackDestinationSigningSecretPresenter.present({
          callbackDestinationSigningSecret
        });
      }),

    delete: callbackDestinationGroup
      .delete(
        instancePath(
          'callback-destinations/:callbackDestinationId',
          'callbacks.destinations.delete'
        ),
        {
          name: 'Delete callback destination',
          description: 'Archives a callback destination.',
          confidential: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .output(callbackDestinationPresenter)
      .do(async ctx => {
        let callbackDestination = await callbackDestinationService.archiveCallbackDestination({
          instance: ctx.instance,
          callbackDestination: ctx.callbackDestination
        });
        callbackDestination = await callbackDestinationService.enrichCallbackDestination({
          instance: ctx.instance,
          callbackDestination
        });

        return callbackDestinationPresenter.present({ callbackDestination });
      })
  }
);
