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
    event_types: listener.type == 'callback' ? null : listener.eventTypes,
    callback_id: listener.type == 'callback' ? listener.callbackId : null,
    triggers: listener.type == 'callback' ? listener.triggers : null,
    chat_connection_id: listener.type == 'chat' ? listener.chatConnectionId : null,
    provider_id: listener.type == 'event' ? null : listener.providerId,
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
      type: v.enumOf(['event', 'callback', 'chat'], {
        description:
          'Whether this listener subscribes to generic resource lifecycle events, to callback trigger events, or to chat connection events'
      }),
      event_types: v.nullable(
        v.array(v.string(), {
          description:
            'Event types to deliver (e.g. `session.created`, `chat.message.received`), present when `type` is `event` or `chat`',
          examples: [['session.created', 'session.completed']]
        })
      ),
      callback_id: v.nullable(
        v.string({
          description:
            'The callback whose trigger events are delivered, present when `type` is `callback` and targeting a specific callback',
          examples: ['clb_1aBcDeFgHjKlMnPq']
        })
      ),
      triggers: v.nullable(
        v.array(v.string(), {
          description: 'Callback trigger keys to deliver, present when `type` is `callback`',
          examples: [['issue.created']]
        })
      ),
      chat_connection_id: v.nullable(
        v.string({
          description:
            'The chat connection whose events are delivered, present when `type` is `chat` and targeting a specific connection',
          examples: ['chc_1aBcDeFgHjKlMnPq']
        })
      ),
      provider_id: v.nullable(
        v.string({
          description:
            'The catalog provider whose callbacks/connections are delivered, present when `type` is `callback` or `chat` and targeting a whole provider',
          examples: ['prv_1aBcDeFgHjKlMnPq']
        })
      ),
      created_at: v.date({ description: 'When the listener was created' }),
      updated_at: v.date({ description: 'When the listener was last updated' })
    })
  )
  .build();
