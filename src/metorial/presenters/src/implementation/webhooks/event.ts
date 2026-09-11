import { v } from '@lowerdeck/validation';
import { resolveSystemEventPayload } from '@metorial/module-event-tracker';
import { Presenter } from '@metorial/presenter';
import { systemEventType } from '../../types';

export let v1SystemEventPresenter = Presenter.create(systemEventType)
  .presenter(async ({ event, organization }) => ({
    object: 'event',
    id: event.id,
    organization_id: organization.id,
    instance_id: event.instance?.id ?? null,
    source: event.source,
    event_type: event.eventType,
    payload: (await resolveSystemEventPayload(event)) as any,
    callback_id: event.callbackId ?? null,
    callback_trigger_key: event.callbackTriggerKey ?? null,
    created_at: event.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('event'),
      id: v.string({
        description: 'Unique identifier for the event',
        examples: ['evnt_1aBcDeFgHjKlMnPq']
      }),
      organization_id: v.string({
        description: 'The organization this event belongs to',
        examples: ['org_1aBcDeFgHjKlMnPq']
      }),
      instance_id: v.nullable(
        v.string({
          description: 'The instance this event occurred in, if any',
          examples: ['ins_1aBcDeFgHjKlMnPq']
        })
      ),
      source: v.enumOf(['resource', 'callback'], {
        description:
          'Whether this event was produced by a normal resource action or by a callback occurrence'
      }),
      event_type: v.string({
        description:
          'The declared event type for `resource` events (e.g. "organization.created"), or a display-only "callback.<trigger_key>" label for `callback` events',
        examples: ['organization.created']
      }),
      payload: v.nullable(
        v.record(v.any(), {
          description:
            'The presenter-shaped event payload for `resource` events. Always `null` for `callback` events — fetch the linked callback event for its payload.'
        })
      ),
      callback_id: v.nullable(
        v.string({
          description:
            'The callback this event is linked to, present only for `callback` events',
          examples: ['cb_1aBcDeFgHjKlMnPq']
        })
      ),
      callback_trigger_key: v.nullable(
        v.string({
          description:
            'The trigger key that produced this event, present only for `callback` events'
        })
      ),
      created_at: v.date({ description: 'When the event was recorded' })
    })
  )
  .build();
