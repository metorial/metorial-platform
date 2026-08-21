import { QueueRetryError } from '@lowerdeck/queue';
import { getSentry } from '@lowerdeck/sentry';
import { db } from '../../db';
import { slateTriggerReceiverService } from '../../services/slateTriggerReceiver';
import { slateTriggerEventProcessQueue } from './eventQueues';

let Sentry = getSentry();

export let slateTriggerEventProcessQueueProcessor = slateTriggerEventProcessQueue.process(
  async data => {
    let eventInput = await db.slateTriggerEventInput.findFirst({
      where: { id: data.eventInputId },
      select: {
        id: true,
        webhookDispatchOutbox: { select: { status: true } }
      }
    });
    if (!eventInput) return;
    if (
      eventInput.webhookDispatchOutbox?.status === 'delivered' ||
      eventInput.webhookDispatchOutbox?.status === 'dead_letter'
    )
      return;

    try {
      await slateTriggerReceiverService.processTriggerEventInput({
        eventInputId: eventInput.id
      });
    } catch (error) {
      Sentry.captureException(error, {
        extra: { eventInputId: data.eventInputId }
      });
      console.error('Failed to process trigger event input:', error);
      throw new QueueRetryError();
    }
  }
);
