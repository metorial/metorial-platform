import type {
  SlateAction,
  SlateInvocation,
  SlateTriggerEvent,
  SlateTriggerReceiver,
  SlateTriggerReceiverTrigger
} from '../../prisma/generated/client';

export let slateTriggerEventPresenter = (
  event: SlateTriggerEvent & {
    receiver: SlateTriggerReceiver;
    receiverTrigger: SlateTriggerReceiverTrigger;
    action: SlateAction;
    invocation: SlateInvocation;
  }
) => ({
  object: 'slate.trigger.event',

  id: event.id,
  type: event.type,
  sourceId: event.sourceId,

  triggerReceiverId: event.receiver.id,
  triggerReceiverTriggerId: event.receiverTrigger.id,
  triggerId: event.action.id,
  triggerKey: event.action.key,
  callbackId: event.callbackId,
  callbackInstanceId: event.callbackInstanceId,

  input: event.input,
  output: event.output,

  deliveryStatus: event.deliveryStatus,
  signalEventId: event.signalEventId,
  invocationId: event.invocation.id,

  createdAt: event.createdAt
});
