import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { eventDestinationListenerService } from '@metorial/module-event-destination';
import { instanceService } from '@metorial/module-organization';
import { eventDestinationListenerPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import {
  organizationGroup,
  organizationManagementPath
} from '../../../middleware/organizationGroup';

export let eventDestinationListenerManagementGroup = organizationGroup.use(async ctx => {
  if (!ctx.params.eventDestinationListenerId) {
    throw new ServiceError(
      badRequestError({
        message: 'eventDestinationListenerId is required',
        description: 'The eventDestinationListenerId path parameter is required.'
      })
    );
  }

  let listener = await eventDestinationListenerService.getEventDestinationListenerById({
    organization: ctx.organization,
    eventDestinationListenerId: ctx.params.eventDestinationListenerId
  });

  return { instance: listener.instance, listener };
});

export let eventDestinationListenerController = Controller.create(
  {
    name: 'Event destination listeners',
    description:
      "Event destination listeners subscribe an event destination to events for a specific instance — either generic resource events, or a callback's trigger events."
  },
  {
    list: eventDestinationListenerManagementGroup
      .get(
        organizationManagementPath(
          'event-destination-listeners',
          'eventDestinationListeners.list'
        ),
        {
          name: 'List event destination listeners',
          description:
            'Returns a paginated list of event destination listeners for the organization.'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.event_destination:read'] }))
      .use(hasFlags(['webhooks-enabled']))
      .outputList(eventDestinationListenerPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            event_destination_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by event destination ID(s)'
            }),
            instance_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by instance ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await eventDestinationListenerService.listEventDestinationListeners({
          organization: ctx.organization,
          instanceIds: normalizeArrayParam(ctx.query.instance_id),
          eventDestinationIds: normalizeArrayParam(ctx.query.event_destination_id)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, listener =>
          eventDestinationListenerPresenter.present({ listener, instance: listener.instance })
        );
      }),

    get: eventDestinationListenerManagementGroup
      .get(
        organizationManagementPath(
          'event-destination-listeners/:eventDestinationListenerId',
          'eventDestinationListeners.get'
        ),
        {
          name: 'Get event destination listener',
          description: 'Retrieves a specific event destination listener by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.event_destination:read'] }))
      .use(hasFlags(['webhooks-enabled']))
      .output(eventDestinationListenerPresenter)
      .do(async ctx =>
        eventDestinationListenerPresenter.present({
          listener: ctx.listener,
          instance: ctx.instance
        })
      ),

    create: eventDestinationListenerManagementGroup
      .post(
        organizationManagementPath(
          'event-destination-listeners',
          'eventDestinationListeners.create'
        ),
        {
          name: 'Create event destination listener',
          description:
            "Subscribes an event destination to events for this instance — either generic resource events or a callback's trigger events."
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.event_destination:write'] }))
      .use(hasFlags(['webhooks-enabled']))
      .body(
        'default',
        v.union([
          v.object({
            instance_id: v.string({
              description: 'Instance that receives the matching events',
              examples: ['ins_1aBcDeFgHjKlMnPq']
            }),
            event_destination_id: v.string({
              description: 'Event destination to deliver matching events to',
              examples: ['evtd_1aBcDeFgHjKlMnPq']
            }),
            type: v.literal('event', {
              description: 'Listen for generic resource lifecycle events'
            }),
            event_types: v.array(v.string(), {
              description: 'Resource event types to deliver, e.g. `session.created`',
              examples: [['session.created', 'session.completed']]
            })
          }),
          v.object({
            instance_id: v.string({
              description: 'Instance that receives the matching events',
              examples: ['ins_1aBcDeFgHjKlMnPq']
            }),
            event_destination_id: v.string({
              description: 'Event destination to deliver matching events to',
              examples: ['evtd_1aBcDeFgHjKlMnPq']
            }),
            type: v.literal('callback', {
              description: "Listen for a specific callback's trigger events"
            }),
            callback_id: v.string({
              description: 'Callback whose trigger events should be delivered',
              examples: ['clb_1aBcDeFgHjKlMnPq']
            }),
            triggers: v.array(v.string(), {
              description: 'Callback trigger keys to deliver',
              examples: [['issue.created']]
            })
          })
        ])
      )
      .output(eventDestinationListenerPresenter)
      .do(async ctx => {
        let instance = await instanceService.getInstanceById({
          organization: ctx.organization,
          instanceId: ctx.body.instance_id,
          member: ctx.member,
          actor: ctx.actor
        });

        let listener = await eventDestinationListenerService.createEventDestinationListener({
          instance,
          auditScope: ctx.auditScope,
          input:
            ctx.body.type == 'event'
              ? {
                  eventDestinationId: ctx.body.event_destination_id,
                  type: 'event',
                  eventTypes: ctx.body.event_types
                }
              : {
                  eventDestinationId: ctx.body.event_destination_id,
                  type: 'callback',
                  callbackId: ctx.body.callback_id,
                  triggers: ctx.body.triggers
                }
        });

        return eventDestinationListenerPresenter.present({ listener, instance });
      }),

    update: eventDestinationListenerManagementGroup
      .patch(
        organizationManagementPath(
          'event-destination-listeners/:eventDestinationListenerId',
          'eventDestinationListeners.update'
        ),
        {
          name: 'Update event destination listener',
          description:
            'Updates the event types or callback triggers an event destination listener subscribes to.'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.event_destination:write'] }))
      .use(hasFlags(['webhooks-enabled']))
      .body(
        'default',
        v.object({
          event_types: v.optional(
            v.array(v.string(), {
              description:
                'Updated resource event types to deliver, present when `type` is `event`',
              examples: [['session.created']]
            })
          ),
          triggers: v.optional(
            v.array(v.string(), {
              description:
                'Updated callback trigger keys to deliver, present when `type` is `callback`',
              examples: [['issue.created']]
            })
          )
        })
      )
      .output(eventDestinationListenerPresenter)
      .do(async ctx => {
        let listener = await eventDestinationListenerService.updateEventDestinationListener({
          instance: ctx.instance,
          listener: ctx.listener,
          auditScope: ctx.auditScope,
          input: {
            eventTypes: ctx.body.event_types,
            triggers: ctx.body.triggers
          }
        });

        return eventDestinationListenerPresenter.present({ listener, instance: ctx.instance });
      }),

    delete: eventDestinationListenerManagementGroup
      .delete(
        organizationManagementPath(
          'event-destination-listeners/:eventDestinationListenerId',
          'eventDestinationListeners.delete'
        ),
        {
          name: 'Delete event destination listener',
          description: 'Removes an event destination listener.'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.event_destination:write'] }))
      .use(hasFlags(['webhooks-enabled']))
      .output(eventDestinationListenerPresenter)
      .do(async ctx => {
        let listener = await eventDestinationListenerService.deleteEventDestinationListener({
          instance: ctx.instance,
          listener: ctx.listener,
          auditScope: ctx.auditScope
        });

        return eventDestinationListenerPresenter.present({ listener, instance: ctx.instance });
      })
  }
);
