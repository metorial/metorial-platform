import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { callbackEventType } from '../../types';

export let v1CallbackEventPresenter = Presenter.create(callbackEventType)
  .presenter(async ({ callbackEvent }) => ({
    object: 'callback.event' as const,
    id: callbackEvent.id,
    type: callbackEvent.type,
    source_id: callbackEvent.sourceId,
    trigger_key: callbackEvent.triggerKey,
    input: callbackEvent.input,
    output: callbackEvent.output,
    delivery_status: callbackEvent.deliveryStatus,
    callback_id: callbackEvent.callbackId,
    callback_instance_id: callbackEvent.callbackInstanceId,
    created_at: callbackEvent.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('callback.event', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique callback event identifier',
        examples: ['cte_4dEfGhJkLmNpQrSt']
      }),
      type: v.string({
        name: 'type',
        description: 'Provider event type received by the callback',
        examples: ['message.created']
      }),
      source_id: v.string({
        name: 'source_id',
        description: 'Provider-specific source identifier for the event',
        examples: ['thr_123456']
      }),
      trigger_key: v.string({
        name: 'trigger_key',
        description: 'Trigger key that produced this event',
        examples: ['messages.created']
      }),
      input: v.record(v.any(), {
        name: 'input',
        description: 'Original trigger input payload captured for the event'
      }),
      output: v.record(v.any(), {
        name: 'output',
        description: 'Trigger output payload resolved for the event'
      }),
      delivery_status: v.string({
        name: 'delivery_status',
        description: 'Aggregate delivery status for this callback event',
        examples: ['delivered']
      }),
      callback_id: v.string({
        name: 'callback_id',
        description: 'Parent callback identifier',
        examples: ['clb_4dEfGhJkLmNpQrSt']
      }),
      callback_instance_id: v.nullable(
        v.string({
          name: 'callback_instance_id',
          description: 'Callback instance that received the event, when applicable',
          examples: ['cbi_5gHjKlMnPqRsTuVw']
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the callback event was created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      })
    })
  )
  .build();
