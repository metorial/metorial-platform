import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  webhookDestinationService,
  webhookEventService
} from '@metorial-subspace/module-callback';
import { webhookEventPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';

let webhookEventGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.webhookEventId) {
    throw new ServiceError(
      badRequestError({
        message: 'webhookEventId is required',
        description: 'The webhookEventId path parameter is required.'
      })
    );
  }
  let webhookEvent = await webhookEventService.getWebhookEvent({
    instance: ctx.instance,
    webhookEventId: ctx.params.webhookEventId
  });
  return { webhookEvent };
});

export let webhookEventController = Controller.create(
  {
    name: 'Webhook Events',
    description: 'Read webhook delivery events from all authorized sources.'
  },
  {
    list: instanceGroup
      .get(instancePath('webhook-events', 'webhooks.events.list'), {
        name: 'List webhook events',
        description: 'Returns a paginated list of webhook events.',
        confidential: true
      })
      .use(checkAccess({ possibleScopes: ['instance.webhook:read'] }))
      .outputList(webhookEventPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            type: v.optional(v.union([v.string(), v.array(v.string())])),
            callback_id: v.optional(v.union([v.string(), v.array(v.string())])),
            destination_id: v.optional(v.string()),
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
        let destinationIds: string[] | undefined;
        if (ctx.query.destination_id) {
          let destination = await webhookDestinationService.getWebhookDestinationById({
            instance: ctx.instance,
            webhookDestinationId: ctx.query.destination_id
          });
          let materialized = await webhookDestinationService.ensureMaterialized({
            instance: ctx.instance,
            webhookDestination: destination
          });
          destinationIds = [materialized.signalEventDestinationId!];
        }
        let list = await webhookEventService.listWebhookEvents({
          instance: ctx.instance,
          filters: {
            callbackIds: normalizeArrayParam(ctx.query.callback_id),
            eventTypes: normalizeArrayParam(ctx.query.type),
            statuses: normalizeArrayParam(ctx.query.status) as
              | ('pending' | 'delivered' | 'failed')[]
              | undefined,
            destinationIds,
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
      }),

    get: webhookEventGroup
      .get(instancePath('webhook-events/:webhookEventId', 'webhooks.events.get'), {
        name: 'Get webhook event',
        description: 'Retrieves a webhook event with its deliveries and attempts.',
        confidential: true
      })
      .use(checkAccess({ possibleScopes: ['instance.webhook:read'] }))
      .output(webhookEventPresenter)
      .do(async ctx => {
        let webhookEventDeliveries = await webhookEventService.listWebhookEventDeliveries({
          instance: ctx.instance,
          webhookEventId: ctx.webhookEvent.id
        });
        return webhookEventPresenter.present({
          webhookEvent: ctx.webhookEvent,
          webhookEventDeliveries
        });
      })
  }
);
