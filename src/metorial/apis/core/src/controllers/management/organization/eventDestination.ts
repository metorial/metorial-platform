import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { eventDestinationService } from '@metorial/module-event-destination';
import { eventDestinationPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import {
  organizationGroup,
  organizationManagementPath
} from '../../../middleware/organizationGroup';

export let eventDestinationManagementGroup = organizationGroup.use(async ctx => {
  if (!ctx.params.eventDestinationId) {
    throw new ServiceError(
      badRequestError({
        message: 'eventDestinationId is required',
        description: 'The eventDestinationId path parameter is required.'
      })
    );
  }

  let eventDestination = await eventDestinationService.getEventDestinationById({
    organization: ctx.organization,
    eventDestinationId: ctx.params.eventDestinationId
  });

  return { eventDestination };
});

export let eventDestinationManagementController = Controller.create(
  {
    name: 'Event destinations',
    description:
      'Event destinations are where Metorial delivers system events for your organization. Webhooks are currently the only supported delivery type.'
  },
  {
    list: organizationGroup
      .get(organizationManagementPath('event-destinations', 'event_destinations.list'), {
        name: 'List event destinations',
        description: 'List all event destinations configured for the organization'
      })
      .use(checkAccess({ possibleScopes: ['organization.event_destination:read'] }))
      .use(hasFlags(['webhooks-enabled']))
      .outputList(eventDestinationPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived']),
                v.array(v.enumOf(['active', 'archived']))
              ]),
              { description: 'Filter by event destination lifecycle status' }
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await eventDestinationService.listEventDestinations({
          organization: ctx.organization,
          statuses: normalizeArrayParam(ctx.query.status)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, eventDestination =>
          eventDestinationPresenter.present({
            eventDestination: { ...eventDestination, organization: ctx.organization }
          })
        );
      }),

    get: eventDestinationManagementGroup
      .get(
        organizationManagementPath(
          'event-destinations/:eventDestinationId',
          'event_destinations.get'
        ),
        {
          name: 'Get event destination',
          description: 'Get a specific event destination configured for the organization'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.event_destination:read'] }))
      .use(hasFlags(['webhooks-enabled']))
      .output(eventDestinationPresenter)
      .do(async ctx =>
        eventDestinationPresenter.present({
          eventDestination: { ...ctx.eventDestination, organization: ctx.organization }
        })
      ),

    create: organizationGroup
      .post(organizationManagementPath('event-destinations', 'event_destinations.create'), {
        name: 'Create event destination',
        description: 'Create an event destination for the organization'
      })
      .use(checkAccess({ possibleScopes: ['organization.event_destination:write'] }))
      .use(hasFlags(['webhooks-enabled']))
      .body(
        'default',
        v.object({
          name: v.string({
            description: 'Display name for the event destination',
            examples: ['Production webhook']
          }),
          description: v.optional(
            v.string({
              description: 'Optional description of what this event destination is used for',
              examples: ['Delivers session and callback events to our internal event bus']
            })
          ),
          type: v.literal('webhook', {
            description:
              'The delivery mechanism to use for this event destination. Only "webhook" is currently supported.'
          }),
          webhook: v.object({
            url: v.string({
              description: 'URL that event deliveries are sent to via HTTP POST',
              modifiers: [v.url()],
              examples: ['https://example.com/webhooks/metorial']
            })
          })
        })
      )
      .output(eventDestinationPresenter)
      .do(async ctx => {
        let eventDestination = await eventDestinationService.createEventDestination({
          organization: ctx.organization,
          auditScope: ctx.auditScope,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            type: ctx.body.type,
            webhook: {
              url: ctx.body.webhook.url
            }
          }
        });

        return eventDestinationPresenter.present({
          eventDestination: { ...eventDestination, organization: ctx.organization },
          revealSecret: eventDestination.webhookDestination?.signingSecret
        });
      }),

    update: eventDestinationManagementGroup
      .patch(
        organizationManagementPath(
          'event-destinations/:eventDestinationId',
          'event_destinations.update'
        ),
        {
          name: 'Update event destination',
          description: 'Update an event destination configured for the organization'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.event_destination:write'] }))
      .use(hasFlags(['webhooks-enabled']))
      .body(
        'default',
        v.object({
          name: v.optional(
            v.string({
              description: 'Updated display name',
              examples: ['Staging webhook']
            })
          ),
          description: v.optional(
            v.nullable(
              v.string({
                description: 'Updated description',
                examples: ['Delivers staging events for QA']
              })
            )
          ),
          webhook: v.optional(
            v.object({
              url: v.optional(
                v.string({
                  description: 'Updated delivery URL',
                  modifiers: [v.url()],
                  examples: ['https://example.com/webhooks/metorial']
                })
              )
            })
          )
        })
      )
      .output(eventDestinationPresenter)
      .do(async ctx => {
        let eventDestination = await eventDestinationService.updateEventDestination({
          organization: ctx.organization,
          eventDestination: ctx.eventDestination,
          auditScope: ctx.auditScope,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            webhook: ctx.body.webhook
          }
        });

        return eventDestinationPresenter.present({
          eventDestination: { ...eventDestination, organization: ctx.organization }
        });
      }),

    archive: eventDestinationManagementGroup
      .post(
        organizationManagementPath(
          'event-destinations/:eventDestinationId/archive',
          'event_destinations.archive'
        ),
        {
          name: 'Archive event destination',
          description:
            'Archives an event destination. Listeners pointed at it stop being delivered to.'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.event_destination:write'] }))
      .use(hasFlags(['webhooks-enabled']))
      .output(eventDestinationPresenter)
      .do(async ctx => {
        let eventDestination = await eventDestinationService.archiveEventDestination({
          organization: ctx.organization,
          eventDestination: ctx.eventDestination,
          auditScope: ctx.auditScope
        });

        return eventDestinationPresenter.present({
          eventDestination: { ...eventDestination, organization: ctx.organization }
        });
      }),

    rotateWebhookSecret: eventDestinationManagementGroup
      .post(
        organizationManagementPath(
          'event-destinations/:eventDestinationId/rotate-webhook-secret',
          'event_destinations.rotate_webhook_secret'
        ),
        {
          name: 'Rotate event destination webhook secret',
          description:
            "Generates a new signing secret for this event destination's webhook, invalidating the previous one. The new secret is only returned in this response."
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.event_destination:write'] }))
      .use(hasFlags(['webhooks-enabled']))
      .output(eventDestinationPresenter)
      .do(async ctx => {
        let { eventDestination, signingSecret } =
          await eventDestinationService.rotateWebhookSecret({
            organization: ctx.organization,
            eventDestination: ctx.eventDestination,
            auditScope: ctx.auditScope
          });

        return eventDestinationPresenter.present({
          eventDestination: { ...eventDestination, organization: ctx.organization },
          revealSecret: signingSecret
        });
      })
  }
);
