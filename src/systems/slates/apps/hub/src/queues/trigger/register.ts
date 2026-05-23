import { QueueRetryError } from '@mtsrc/queue';
import { getSentry } from '@mtsrc/sentry';
import { db } from '../../db';
import { slateTriggerReceiverService } from '../../services/slateTriggerReceiver';
import {
  slateTriggerWebhookRegisterQueue,
  slateTriggerWebhookUnregisterQueue
} from './eventQueues';

let Sentry = getSentry();

export let slateTriggerWebhookRegisterQueueProcessor =
  slateTriggerWebhookRegisterQueue.process(async data => {
    let receiverTrigger = await db.slateTriggerReceiverTrigger.findFirst({
      where: { id: data.receiverTriggerId },
      select: { id: true }
    });
    if (!receiverTrigger) return;

    try {
      await slateTriggerReceiverService.registerWebhookForReceiverTriggerId({
        receiverTriggerId: receiverTrigger.id
      });
    } catch (error) {
      Sentry.captureException(error, {
        extra: { receiverTriggerId: data.receiverTriggerId }
      });
      console.error('Failed to auto-register trigger webhook:', error);
      throw new QueueRetryError();
    }
  });

export let slateTriggerWebhookUnregisterQueueProcessor =
  slateTriggerWebhookUnregisterQueue.process(async data => {
    let receiverTrigger = await db.slateTriggerReceiverTrigger.findFirst({
      where: { id: data.receiverTriggerId },
      select: { id: true }
    });
    if (!receiverTrigger) return;

    try {
      await slateTriggerReceiverService.unregisterWebhookForReceiverTriggerId({
        receiverTriggerId: receiverTrigger.id
      });
    } catch (error) {
      Sentry.captureException(error, {
        extra: { receiverTriggerId: data.receiverTriggerId }
      });
      console.error('Failed to auto-unregister trigger webhook:', error);
      throw new QueueRetryError();
    }
  });
