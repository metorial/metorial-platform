import type {
  SlateAction,
  SlateTriggerEvent,
  SlateTriggerEventInput,
  SlateTriggerReceiver,
  SlateTriggerReceiverTrigger
} from '../../prisma/generated/client';

export let slateTriggerEventInputPresenter = (
  input: SlateTriggerEventInput & {
    receiver: SlateTriggerReceiver;
    receiverTrigger: SlateTriggerReceiverTrigger;
    action: SlateAction;
    event: SlateTriggerEvent | null;
  }
) => ({
  object: 'slate.trigger.event_input',

  id: input.id,
  status: input.status,
  attemptCount: input.attemptCount,

  error: input.errorCode
    ? {
        code: input.errorCode,
        message: input.errorMessage ?? input.errorCode
      }
    : null,

  triggerReceiverId: input.receiver.id,
  triggerReceiverTriggerId: input.receiverTrigger.id,
  triggerId: input.action.id,
  triggerKey: input.action.key,

  eventId: input.event?.id ?? null,

  createdAt: input.createdAt,
  updatedAt: input.updatedAt
});
