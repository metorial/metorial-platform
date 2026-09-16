import type {
  Slate,
  SlateTriggerGroup,
  SlateWebhookEvent,
  SlateWebhookRegistration
} from '../../prisma/generated/client';
import { loadOffloadedWebhookEventRequest } from '../queues/webhook/payloadOffload';

export let slateWebhookEventPresenter = async (
  event: SlateWebhookEvent & {
    webhookRegistration: SlateWebhookRegistration & {
      slate: Slate;
      triggerGroup: SlateTriggerGroup;
    };
  }
) => {
  let request = event.request;
  if (request === null && event.requestStorageKey) {
    request = await loadOffloadedWebhookEventRequest(event.requestStorageKey);
  }

  return {
    object: 'webhook_event',

    id: event.id,
    status: event.status,
    attemptCount: event.attemptCount,

    webhookRegistrationId: event.webhookRegistration.id,
    slateId: event.webhookRegistration.slate.id,
    triggerGroupId: event.webhookRegistration.triggerGroup.id,

    request,
    slateResponse: event.slateResponse,

    createdAt: event.createdAt,
    updatedAt: event.updatedAt
  };
};
