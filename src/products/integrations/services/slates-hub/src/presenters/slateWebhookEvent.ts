import type {
  Slate,
  SlateTriggerGroup,
  SlateWebhookEvent,
  SlateWebhookRegistration
} from '../../prisma/generated/client';
import { redactWebhookRequest } from '../lib/redactWebhookRequest';
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

let presentWebhookEvent = async (
  event: PresentedSlateWebhookEvent,
  redact: (request: PrismaJson.SlateWebhookEventRequest | null) => typeof request
) => {
  let request = event.request;
  if (request === null && event.requestStorageKey) {
    request = await loadOffloadedWebhookEventRequest(event.requestStorageKey);
  }

  return {
    ...(await slateWebhookEventListPresenter(event)),

    request: redact(request),
    slateResponse: event.slateResponse
  };
};

export let slateWebhookEventPresenter = (event: PresentedSlateWebhookEvent) =>
  presentWebhookEvent(event, request =>
    redactWebhookRequest(request, event.webhookRegistration)
  );

// Operators can see every registration's receive URL already, so theirs stays in place.
export let slateWebhookEventAdminPresenter = (event: PresentedSlateWebhookEvent) =>
  presentWebhookEvent(event, request => redactWebhookRequest(request));
