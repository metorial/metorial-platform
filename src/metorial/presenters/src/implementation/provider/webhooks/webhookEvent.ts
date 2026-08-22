import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { webhookEventType } from '../../../types';
import { v1WebhookEventDeliveryPresenter } from './webhookEventDelivery';

let callbackWebhookSourceSchema = v.object(
  {
    type: v.literal('callback'),
    callback_id: v.string(),
    callback_instance_id: v.nullable(v.string()),
    callback_trigger_id: v.nullable(v.string())
  },
  {
    description:
      'Webhook source variant. Additional source types may be added without changing top-level event fields.'
  }
);

let senderWebhookSourceSchema = v.object(
  {
    type: v.literal('sender'),
    sender_id: v.string(),
    sender_identifier: v.string(),
    sender_name: v.string()
  },
  {
    description:
      'Generic webhook source backed by the Signal sender that emitted the event.'
  }
);

export let v1WebhookEventPresenter = Presenter.create(webhookEventType)
  .presenter(async ({ webhookEvent, webhookEventDeliveries }, opts) => {
    let source = (() => {
      if (webhookEvent.callbackId) {
        return {
          type: 'callback' as const,
          callback_id: webhookEvent.callbackId,
          callback_instance_id: webhookEvent.callbackInstanceId,
          callback_trigger_id: webhookEvent.callbackTriggerId
        };
      }

      return {
        type: 'sender' as const,
        sender_id: webhookEvent.sender.id,
        sender_identifier: webhookEvent.sender.identifier,
        sender_name: webhookEvent.sender.name
      };
    })();

    return {
      object: 'webhook.event' as const,
      id: webhookEvent.id,
      type: webhookEvent.type,
      topics: webhookEvent.topics,
      status: webhookEvent.status,
      request: webhookEvent.request
        ? {
            body: webhookEvent.request.body,
            headers: webhookEvent.request.headers
          }
        : null,
      delivery_destination_count: webhookEvent.destinationCount,
      delivery_success_count: webhookEvent.successCount,
      delivery_failure_count: webhookEvent.failureCount,
      source,
      deliveries: webhookEventDeliveries
        ? await Promise.all(
            webhookEventDeliveries.map(delivery =>
              v1WebhookEventDeliveryPresenter
                .present({ webhookEventDelivery: delivery }, opts)
                .run()
            )
          )
        : null,
      created_at: webhookEvent.createdAt,
      updated_at: webhookEvent.updatedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('webhook.event'),
      id: v.string({ description: 'Unique webhook event identifier' }),
      type: v.string({ description: 'Webhook event type' }),
      topics: v.array(v.string(), { description: 'Topics associated with the event' }),
      status: v.enumOf(['pending', 'delivered', 'failed'] as const),
      request: v.nullable(
        v.object({
          body: v.string(),
          headers: v.nullable(v.array(v.object({ key: v.string(), value: v.string() })))
        })
      ),
      delivery_destination_count: v.nullable(v.number()),
      delivery_success_count: v.number(),
      delivery_failure_count: v.number(),
      source: v.union([callbackWebhookSourceSchema, senderWebhookSourceSchema]),
      deliveries: v.nullable(v.array(v1WebhookEventDeliveryPresenter.schema)),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
