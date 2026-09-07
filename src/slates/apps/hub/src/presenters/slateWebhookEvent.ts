import type {
  Slate,
  SlateTriggerGroup,
  SlateWebhookEvent,
  SlateWebhookRegistration
} from '../../prisma/generated/client';

export let slateWebhookEventPresenter = (
  event: SlateWebhookEvent & {
    webhookRegistration: SlateWebhookRegistration & {
      slate: Slate;
      triggerGroup: SlateTriggerGroup;
    };
  }
) => ({
  object: 'slate.webhook_event',

  id: event.id,
  status: event.status,
  attemptCount: event.attemptCount,

  webhookRegistrationId: event.webhookRegistration.id,
  slateId: event.webhookRegistration.slate.id,
  triggerGroupId: event.webhookRegistration.triggerGroup.id,

  request: event.request,
  slateResponse: event.slateResponse,

  createdAt: event.createdAt,
  updatedAt: event.updatedAt
});
