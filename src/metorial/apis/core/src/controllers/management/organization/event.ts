import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { eventLogService } from '@metorial/module-event-log';
import { eventPresenter, webhookEventPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import {
  organizationGroup,
  organizationManagementPath
} from '../../../middleware/organizationGroup';

export let eventManagementController = Controller.create(
  {
    name: 'Events',
    description:
      'Events are the record of everything Metorial delivers to your event destinations — both normal resource events and callback occurrences.'
  },
  {
    listWebhookEvents: organizationGroup
      .get(organizationManagementPath('webhook-events', 'webhookEvents.list'), {
        name: 'List webhook events',
        description: 'List all event types that event destination listeners can subscribe to'
      })
      .use(checkAccess({ possibleScopes: ['organization.event_destination:read'] }))
      .use(hasFlags(['webhooks-enabled']))
      .outputList(webhookEventPresenter)
      .do(async () => {
        let webhookEvents = await eventLogService.getWebhookEvents();

        return Paginator.present(
          {
            items: webhookEvents,
            pagination: {
              hasNextPage: false,
              hasPreviousPage: false
            }
          },
          webhookEvent => webhookEventPresenter.present({ webhookEvent })
        );
      }),

    list: organizationGroup
      .get(organizationManagementPath('events', 'events.list'), {
        name: 'List events',
        description: 'List events recorded for the organization'
      })
      .use(checkAccess({ possibleScopes: ['organization.event:read'] }))
      .use(hasFlags(['webhooks-enabled']))
      .outputList(eventPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            instance_id: v.optional(v.string({ description: 'Filter by instance' })),
            event_type: v.optional(
              v.union([v.string(), v.array(v.string())], {
                description: 'Filter by event type (e.g. "organization.created")'
              })
            ),
            source: v.optional(
              v.union(
                [
                  v.enumOf(['resource', 'callback']),
                  v.array(v.enumOf(['resource', 'callback']))
                ],
                {
                  description: 'Filter by event source'
                }
              )
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await eventLogService.listEvents({
          organization: ctx.organization,
          instanceId: ctx.query.instance_id,
          eventTypes: normalizeArrayParam(ctx.query.event_type),
          sources: normalizeArrayParam(ctx.query.source)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, event =>
          eventPresenter.present({ event, organization: ctx.organization })
        );
      }),

    get: organizationGroup
      .get(organizationManagementPath('events/:eventId', 'events.get'), {
        name: 'Get event',
        description: 'Get a specific event recorded for the organization'
      })
      .use(checkAccess({ possibleScopes: ['organization.event:read'] }))
      .use(hasFlags(['webhooks-enabled']))
      .output(eventPresenter)
      .do(async ctx => {
        let event = await eventLogService.getEventById({
          organization: ctx.organization,
          eventId: ctx.params.eventId
        });

        return eventPresenter.present({ event, organization: ctx.organization });
      })
  }
);
