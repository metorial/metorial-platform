import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { webhookDestinationService } from '@metorial-subspace/module-callback';
import {
  webhookDestinationPresenter,
  webhookDestinationSigningSecretPresenter,
  webhookEventPresenter
} from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { isDashboardGroup } from '../../../middleware/isDashboard';

let webhookDestinationGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.webhookDestinationId) {
    throw new ServiceError(
      badRequestError({
        message: 'webhookDestinationId is required',
        description: 'The webhookDestinationId path parameter is required.'
      })
    );
  }
  let webhookDestination = await webhookDestinationService.getWebhookDestinationById({
    instance: ctx.instance,
    webhookDestinationId: ctx.params.webhookDestinationId
  });
  return { webhookDestination };
});

let dashboardWebhookDestinationGroup = instanceGroup
  .use(isDashboardGroup())
  .use(checkAccess({ possibleScopes: ['instance.webhook:write'] }))
  .use(async ctx => {
    if (!ctx.params.webhookDestinationId) {
      throw new ServiceError(
        badRequestError({
          message: 'webhookDestinationId is required',
          description: 'The webhookDestinationId path parameter is required.'
        })
      );
    }
    let webhookDestination = await webhookDestinationService.getWebhookDestinationById({
      instance: ctx.instance,
      webhookDestinationId: ctx.params.webhookDestinationId
    });
    return { webhookDestination };
  });

let destinationBody = {
  name: v.string({ description: 'Display name for the webhook destination' }),
  description: v.optional(v.string({ description: 'Optional destination description' })),
  metadata: v.optional(v.record(v.any(), { description: 'Custom destination metadata' })),
  url: v.string({ description: 'Webhook URL that receives deliveries' }),
  method: v.optional(v.enumOf(['POST', 'PUT', 'PATCH'] as const), {
    description: 'HTTP method used for webhook delivery'
  })
};

export let webhookDestinationController = Controller.create(
  {
    name: 'Webhook Destinations',
    description: 'Manage webhook delivery destinations.'
  },
  {
    list: instanceGroup
      .get(instancePath('webhook-destinations', 'webhooks.destinations.list'), {
        name: 'List webhook destinations',
        description: 'Returns a paginated list of webhook destinations.',
        confidential: true
      })
      .use(checkAccess({ possibleScopes: ['instance.webhook:read'] }))
      .outputList(webhookDestinationPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            callback_id: v.optional(v.union([v.string(), v.array(v.string())])),
            created_at: dateFilterValidator('webhook destination creation time'),
            updated_at: dateFilterValidator('webhook destination last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await webhookDestinationService.listWebhookDestinations({
          instance: ctx.instance,
          callbackIds: normalizeArrayParam(ctx.query.callback_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });
        let list = await paginator.run(ctx.query);
        let webhookDestinations = await webhookDestinationService.enrichWebhookDestinations({
          instance: ctx.instance,
          webhookDestinations: list.items
        });
        return Paginator.present({ ...list, items: webhookDestinations }, webhookDestination =>
          webhookDestinationPresenter.present({ webhookDestination })
        );
      }),

    get: webhookDestinationGroup
      .get(
        instancePath(
          'webhook-destinations/:webhookDestinationId',
          'webhooks.destinations.get'
        ),
        {
          name: 'Get webhook destination',
          description: 'Retrieves a specific webhook destination.',
          confidential: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.webhook:read'] }))
      .output(webhookDestinationPresenter)
      .do(async ctx => {
        let webhookDestination = await webhookDestinationService.enrichWebhookDestination({
          instance: ctx.instance,
          webhookDestination: ctx.webhookDestination
        });
        return webhookDestinationPresenter.present({ webhookDestination });
      }),

    create: instanceGroup
      .post(instancePath('webhook-destinations', 'webhooks.destinations.create'), {
        name: 'Create webhook destination',
        description: 'Creates and materializes a webhook destination.',
        confidential: true
      })
      .use(checkAccess({ possibleScopes: ['instance.webhook:write'] }))
      .body('default', v.object(destinationBody))
      .output(webhookDestinationPresenter)
      .do(async ctx => {
        let webhookDestination = await webhookDestinationService.createWebhookDestination({
          instance: ctx.instance,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            url: ctx.body.url,
            method: ctx.body.method ?? 'POST'
          }
        });
        webhookDestination = await webhookDestinationService.enrichWebhookDestination({
          instance: ctx.instance,
          webhookDestination
        });
        return webhookDestinationPresenter.present({ webhookDestination });
      }),

    update: webhookDestinationGroup
      .patch(
        instancePath(
          'webhook-destinations/:webhookDestinationId',
          'webhooks.destinations.update'
        ),
        {
          name: 'Update webhook destination',
          description: 'Updates a webhook destination.',
          confidential: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.webhook:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(destinationBody.name),
          description: destinationBody.description,
          metadata: destinationBody.metadata,
          url: v.optional(destinationBody.url),
          method: destinationBody.method
        })
      )
      .output(webhookDestinationPresenter)
      .do(async ctx => {
        let webhookDestination = await webhookDestinationService.updateWebhookDestination({
          instance: ctx.instance,
          webhookDestination: ctx.webhookDestination,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            url: ctx.body.url,
            method: ctx.body.method
          }
        });
        webhookDestination = await webhookDestinationService.enrichWebhookDestination({
          instance: ctx.instance,
          webhookDestination
        });
        return webhookDestinationPresenter.present({ webhookDestination });
      }),

    rotateSigningSecret: dashboardWebhookDestinationGroup
      .post(
        instancePath(
          'webhook-destinations/:webhookDestinationId/security/signing-secret/rotate',
          'webhooks.destinations.rotateSigningSecret'
        ),
        {
          name: 'Rotate webhook destination signing secret',
          description: 'Rotates the outbound webhook signing secret and returns it once.',
          confidential: true
        }
      )
      .output(webhookDestinationSigningSecretPresenter)
      .do(async ctx => {
        let webhookDestinationSigningSecret =
          await webhookDestinationService.rotateSigningSecret({
            instance: ctx.instance,
            webhookDestination: ctx.webhookDestination
          });
        return webhookDestinationSigningSecretPresenter.present({
          webhookDestinationSigningSecret
        });
      }),

    delete: webhookDestinationGroup
      .delete(
        instancePath(
          'webhook-destinations/:webhookDestinationId',
          'webhooks.destinations.delete'
        ),
        {
          name: 'Delete webhook destination',
          description: 'Archives a webhook destination.',
          confidential: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.webhook:write'] }))
      .output(webhookDestinationPresenter)
      .do(async ctx => {
        let webhookDestination = await webhookDestinationService.archiveWebhookDestination({
          instance: ctx.instance,
          webhookDestination: ctx.webhookDestination
        });
        return webhookDestinationPresenter.present({ webhookDestination });
      }),

    listEvents: webhookDestinationGroup
      .get(
        instancePath(
          'webhook-destinations/:webhookDestinationId/events',
          'webhooks.destinations.events.list'
        ),
        {
          name: 'List webhook destination events',
          description: 'Lists webhook events delivered to this destination.',
          confidential: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.webhook:read'] }))
      .outputList(webhookEventPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            type: v.optional(v.union([v.string(), v.array(v.string())])),
            callback_id: v.optional(v.union([v.string(), v.array(v.string())])),
            status: v.optional(
              v.union([
                v.enumOf(['pending', 'delivered', 'failed']),
                v.array(v.enumOf(['pending', 'delivered', 'failed']))
              ])
            )
          })
        )
      )
      .do(async ctx => {
        let list = await webhookDestinationService.listWebhookDestinationEvents({
          instance: ctx.instance,
          webhookDestination: ctx.webhookDestination,
          filters: {
            callbackIds: normalizeArrayParam(ctx.query.callback_id),
            eventTypes: normalizeArrayParam(ctx.query.type),
            statuses: normalizeArrayParam(ctx.query.status) as
              | ('pending' | 'delivered' | 'failed')[]
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
          webhookEvent => webhookEventPresenter.present({ webhookEvent })
        );
      })
  }
);
