import type {
  Slate,
  SlateTriggerGroup,
  SlateWebhookEvent,
  SlateWebhookRegistration
} from '../../prisma/generated/client';
import { loadOffloadedWebhookEventRequest } from '../queues/webhook/payloadOffload';

type PresentedSlateWebhookEvent = SlateWebhookEvent & {
  webhookRegistration: SlateWebhookRegistration & {
    slate: Slate;
    triggerGroup: SlateTriggerGroup;
  };
};

export let slateWebhookEventListPresenter = async (event: PresentedSlateWebhookEvent) => ({
  object: 'webhook_event',

  id: event.id,
  status: event.status,
  attemptCount: event.attemptCount,

  webhookRegistrationId: event.webhookRegistration.id,
  slateId: event.webhookRegistration.slate.id,
  triggerGroupId: event.webhookRegistration.triggerGroup.id,

  createdAt: event.createdAt,
  updatedAt: event.updatedAt
});

export let slateWebhookEventPresenter = async (event: PresentedSlateWebhookEvent) => {
  let request = event.request;
  if (request === null && event.requestStorageKey) {
    request = await loadOffloadedWebhookEventRequest(event.requestStorageKey);
  }

  return {
    ...(await slateWebhookEventListPresenter(event)),

    request,
    slateResponse: event.slateResponse
  };
};
