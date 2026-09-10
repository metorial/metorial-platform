import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { eventDestinationListenerType } from '../../types';

export let v1EventDestinationListenerPresenter = Presenter.create(eventDestinationListenerType)
  .presenter(async ({ listener, instance }) => ({
    object: 'event.destination_listener',
    id: listener.id,
    instance_id: instance.id,
    event_destination_id: listener.eventDestination.id,
    type: listener.type,
    event_types: listener.type == 'event' ? listener.eventTypes : null,
    callback_id: listener.type == 'callback' ? listener.callbackId : null,
    triggers: listener.type == 'callback' ? listener.triggers : null,
    created_at: listener.createdAt,
    updated_at: listener.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('event.destination_listener'),
      id: v.string({
        description: 'Unique identifier for the event destination listener',
        examples: ['evtl_1aBcDeFgHjKlMnPq']
      }),
      instance_id: v.string({
        description: 'The instance this listener subscribes on behalf of',
        examples: ['ins_1aBcDeFgHjKlMnPq']
      }),
      event_destination_id: v.string({
        description: 'The event destination that receives matching events',
        examples: ['evtd_1aBcDeFgHjKlMnPq']
      }),
      type: v.enumOf(['event', 'callback'], {
        description:
          "Whether this listener subscribes to generic resource lifecycle events, or to a specific callback's trigger events"
      }),
      event_types: v.nullable(
        v.array(v.string(), {
          description:
            'Resource event types to deliver (e.g. `session.created`), present when `type` is `event`',
          examples: [['session.created', 'session.completed']]
        })
      ),
      callback_id: v.nullable(
        v.string({
          description:
            'The callback whose trigger events are delivered, present when `type` is `callback`',
          examples: ['clb_1aBcDeFgHjKlMnPq']
        })
      ),
      triggers: v.nullable(
        v.array(v.string(), {
          description: 'Callback trigger keys to deliver, present when `type` is `callback`',
          examples: [['issue.created']]
        })
      ),
      created_at: v.date({ description: 'When the listener was created' }),
      updated_at: v.date({ description: 'When the listener was last updated' })
    })
  )
  .build();
