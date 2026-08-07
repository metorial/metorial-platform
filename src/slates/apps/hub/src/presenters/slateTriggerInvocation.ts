import type {
  SlateInvocation,
  SlateTriggerEvent,
  SlateTriggerInvocation,
  SlateTriggerReceiver,
  SlateTriggerReceiverTrigger
} from '../../prisma/generated/client';
import { slateInvocationLitePresenter } from './slateInvocation';

export let slateTriggerInvocationPresenter = async (
  invocation: SlateTriggerInvocation & {
    invocation: SlateInvocation;
    receiver: SlateTriggerReceiver;
    receiverTrigger: SlateTriggerReceiverTrigger | null;
    event: SlateTriggerEvent | null;
  }
) => ({
  object: 'slate.trigger.invocation',

  id: invocation.id,
  type: invocation.type,
  hasResponse: invocation.hasResponse,

  triggerReceiverId: invocation.receiver.id,
  triggerReceiverTriggerId: invocation.receiverTrigger?.id ?? null,
  triggerEventId: invocation.event?.id ?? null,

  invocation: await slateInvocationLitePresenter(invocation.invocation),

  createdAt: invocation.createdAt
});
