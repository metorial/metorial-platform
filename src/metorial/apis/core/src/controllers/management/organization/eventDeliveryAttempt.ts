import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  eventDeliveryAttemptService,
  resolveAttemptDetails
} from '@metorial/module-event-delivery';
import { eventDeliveryAttemptPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import {
  organizationGroup,
  organizationManagementPath
} from '../../../middleware/organizationGroup';

export let eventDeliveryAttemptManagementController = Controller.create(
  {
    name: 'Event delivery attempts',
    description:
      'A delivery attempt is one request Metorial made to an event destination, with the request it sent and the response it got back.'
  },
  {
    list: organizationGroup
      .get(
        organizationManagementPath('event-delivery-attempts', 'eventDeliveryAttempts.list'),
        {
          name: 'List event delivery attempts',
          description: 'List delivery attempts recorded for the organization'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.event_delivery:read'] }))
      .use(hasFlags(['webhooks-enabled']))
      .outputList(eventDeliveryAttemptPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union(
                [
                  v.enumOf(['succeeded', 'failed']),
                  v.array(v.enumOf(['succeeded', 'failed']))
                ],
                { description: 'Filter by attempt outcome' }
              )
            ),
            event_delivery_id: v.optional(
              v.union([v.string(), v.array(v.string())], {
                description: 'Filter by the delivery the attempts belong to'
              })
            ),
            event_id: v.optional(
              v.union([v.string(), v.array(v.string())], {
                description: 'Filter by the event being delivered'
              })
            ),
            event_destination_id: v.optional(
              v.union([v.string(), v.array(v.string())], {
                description: 'Filter by the event destination being delivered to'
              })
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await eventDeliveryAttemptService.listEventDeliveryAttempts({
          organization: ctx.organization,
          statuses: normalizeArrayParam(ctx.query.status),
          eventDeliveryIds: normalizeArrayParam(ctx.query.event_delivery_id),
          eventIds: normalizeArrayParam(ctx.query.event_id),
          eventDestinationIds: normalizeArrayParam(ctx.query.event_destination_id)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, attempt =>
          eventDeliveryAttemptPresenter.present({ attempt })
        );
      }),

    get: organizationGroup
      .get(
        organizationManagementPath(
          'event-delivery-attempts/:eventDeliveryAttemptId',
          'eventDeliveryAttempts.get'
        ),
        {
          name: 'Get event delivery attempt',
          description:
            'Get a specific delivery attempt, including the request Metorial sent and the response the destination returned'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.event_delivery:read'] }))
      .use(hasFlags(['webhooks-enabled']))
      .output(eventDeliveryAttemptPresenter)
      .do(async ctx => {
        let attempt = await eventDeliveryAttemptService.getEventDeliveryAttemptById({
          organization: ctx.organization,
          eventDeliveryAttemptId: ctx.params.eventDeliveryAttemptId
        });

        return eventDeliveryAttemptPresenter.present({
          attempt,
          details: await resolveAttemptDetails(attempt)
        });
      })
  }
);
