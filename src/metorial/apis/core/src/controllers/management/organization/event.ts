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
      'Events are the record of everything Metorial delivers to your event destinations — normal resource events, callback occurrences, chat connection events, and manual pings.'
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
                  v.enumOf(['resource', 'callback', 'chat', 'ping']),
                  v.array(v.enumOf(['resource', 'callback', 'chat', 'ping']))
                ],
                {
                  description: 'Filter by event source'
                }
              )
            ),
            callback_id: v.optional(
              v.union([v.string(), v.array(v.string())], {
                description: 'Filter by callback ID(s), for events whose source is `callback`'
              })
            ),
            callback_trigger_key: v.optional(
              v.union([v.string(), v.array(v.string())], {
                description:
                  'Filter by callback trigger key(s), for events whose source is `callback`'
              })
            ),
            chat_connection_id: v.optional(
              v.union([v.string(), v.array(v.string())], {
                description:
                  'Filter by chat connection ID(s), for events whose source is `chat`'
              })
            ),
            provider_id: v.optional(
              v.union([v.string(), v.array(v.string())], {
                description: 'Filter by catalog provider ID(s)'
              })
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await eventLogService.listEvents({
          organization: ctx.organization,
          instanceId: ctx.query.instance_id,
          eventTypes: normalizeArrayParam(ctx.query.event_type),
          sources: normalizeArrayParam(ctx.query.source),
          callbackIds: normalizeArrayParam(ctx.query.callback_id),
          callbackTriggerKeys: normalizeArrayParam(ctx.query.callback_trigger_key),
          chatConnectionIds: normalizeArrayParam(ctx.query.chat_connection_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id)
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
