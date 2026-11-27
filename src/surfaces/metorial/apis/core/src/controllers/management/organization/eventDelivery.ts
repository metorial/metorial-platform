import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { eventDeliveryService } from '@metorial/module-event-delivery';
import { eventDeliveryPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import {
  organizationGroup,
  organizationManagementPath
} from '../../../middleware/organizationGroup';

export let eventDeliveryManagementGroup = organizationGroup.use(async ctx => {
  if (!ctx.params.eventDeliveryId) {
    throw new ServiceError(
      badRequestError({
        message: 'eventDeliveryId is required',
        description: 'The eventDeliveryId path parameter is required.'
      })
    );
  }

  let eventDelivery = await eventDeliveryService.getEventDeliveryById({
    organization: ctx.organization,
    eventDeliveryId: ctx.params.eventDeliveryId
  });

  return { eventDelivery };
});

export let eventDeliveryManagementController = Controller.create(
  {
    name: 'Event deliveries',
    description: `An event delivery is Metorial's record of sending one event to one event destination, including every attempt it took to get there.`
  },
  {
    list: organizationGroup
      .get(organizationManagementPath('event-deliveries', 'eventDeliveries.list'), {
        name: 'List event deliveries',
        description: 'List event deliveries recorded for the organization'
      })
      .use(checkAccess({ possibleScopes: ['organization.event_delivery:read'] }))
      .use(hasFlags(['webhooks-enabled']))
      .outputList(eventDeliveryPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union(
                [
                  v.enumOf(['pending', 'retrying', 'delivered', 'failed', 'cancelled']),
                  v.array(
                    v.enumOf(['pending', 'retrying', 'delivered', 'failed', 'cancelled'])
                  )
                ],
                { description: 'Filter by delivery status' }
              )
            ),
            event_id: v.optional(
              v.union([v.string(), v.array(v.string())], {
                description: 'Filter by the event being delivered'
              })
            ),
            event_type: v.optional(
              v.union([v.string(), v.array(v.string())], {
                description: 'Filter by the type of the event being delivered'
              })
            ),
            event_destination_id: v.optional(
              v.union([v.string(), v.array(v.string())], {
                description: 'Filter by the event destination being delivered to'
              })
            ),
            instance_id: v.optional(
              v.union([v.string(), v.array(v.string())], {
                description: 'Filter by the instance the delivered event occurred in'
              })
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await eventDeliveryService.listEventDeliveries({
          organization: ctx.organization,
          statuses: normalizeArrayParam(ctx.query.status),
          eventIds: normalizeArrayParam(ctx.query.event_id),
          eventTypes: normalizeArrayParam(ctx.query.event_type),
          eventDestinationIds: normalizeArrayParam(ctx.query.event_destination_id),
          instanceIds: normalizeArrayParam(ctx.query.instance_id)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, eventDelivery =>
          eventDeliveryPresenter.present({ eventDelivery, organization: ctx.organization })
        );
      }),

    get: eventDeliveryManagementGroup
      .get(
        organizationManagementPath('event-deliveries/:eventDeliveryId', 'eventDeliveries.get'),
        {
          name: 'Get event delivery',
          description: 'Get a specific event delivery recorded for the organization'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.event_delivery:read'] }))
      .use(hasFlags(['webhooks-enabled']))
      .output(eventDeliveryPresenter)
      .do(async ctx =>
        eventDeliveryPresenter.present({
          eventDelivery: ctx.eventDelivery,
          organization: ctx.organization
        })
      ),

    retry: eventDeliveryManagementGroup
      .post(
        organizationManagementPath(
          'event-deliveries/:eventDeliveryId/retry',
          'eventDeliveries.retry'
        ),
        {
          name: 'Retry event delivery',
          description:
            'Schedules another attempt for a delivery that has finished, whether it succeeded or gave up. The delivery is given a fresh attempt budget.'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.event_delivery:write'] }))
      .use(hasFlags(['webhooks-enabled']))
      .output(eventDeliveryPresenter)
      .do(async ctx => {
        let eventDelivery = await eventDeliveryService.retryEventDelivery({
          organization: ctx.organization,
          eventDelivery: ctx.eventDelivery,
          auditScope: ctx.auditScope
        });

        return eventDeliveryPresenter.present({
          eventDelivery,
          organization: ctx.organization
        });
      })
  }
);
