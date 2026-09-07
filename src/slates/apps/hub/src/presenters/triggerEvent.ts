import type {
  CallbackInstance,
  SlateTriggerGroup,
  TriggerEvent,
  TriggerRegistration,
  TriggerRegistrationInstance
} from '../../prisma/generated/client';

export let triggerEventPresenter = (
  event: TriggerEvent & {
    triggerRegistrationInstance: TriggerRegistrationInstance & {
      triggerGroup: SlateTriggerGroup;
      triggerRegistration: TriggerRegistration & { callbackInstance: CallbackInstance | null };
    };
    webhookEvent: { id: string } | null;
  }
) => ({
  object: 'trigger_event',

  id: event.id,
  status: event.status,
  source: event.source,

  triggerId: event.triggerId,
  triggerGroupId: event.triggerRegistrationInstance.triggerGroup.id,
  triggerRegistrationId: event.triggerRegistrationInstance.triggerRegistration.id,
  triggerRegistrationInstanceId: event.triggerRegistrationInstance.id,
  callbackInstanceId:
    event.triggerRegistrationInstance.triggerRegistration.callbackInstance?.id ?? null,

  mappedType: event.mappedType,
  mappedId: event.mappedId,
  payload: event.payload,

  webhookEventId: event.webhookEvent?.id ?? null,

  attemptCount: event.attemptCount,
  errorCode: event.errorCode,
  errorMessage: event.errorMessage,

  createdAt: event.createdAt,
  updatedAt: event.updatedAt
});
