import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { eventFailedQueue, eventSucceededQueue } from './lifecycle';

export let intentSucceededQueue = createQueue<{
  intentId: string;
  errorCode: string;
  errorMessage: string;
}>({
  name: 'sgnl/event/intent_succeeded',
  redisUrl: env.service.REDIS_URL
});

export let intentSucceededQueueProcessor = intentSucceededQueue.process(async data => {
  let intent = await db.eventDeliveryIntent.findFirst({
    where: { id: data.intentId }
  });
  if (!intent) throw new QueueRetryError();

  await db.eventDeliveryIntent.updateMany({
    where: { id: data.intentId },
    data: {
      status: 'delivered'
    }
  });

  await db.event.update({
    where: { oid: intent.eventOid },
    data: {
      deliverySuccessCount: { increment: 1 }
    }
  });

  await intentEndedQueue.add({ intentId: intent.id });
});

export let intentFailedQueue = createQueue<{
  intentId: string;
  errorCode: string;
  errorMessage: string;
}>({
  name: 'sgnl/event/intent_failed',
  redisUrl: env.service.REDIS_URL
});

export let intentFailedQueueProcessor = intentFailedQueue.process(async data => {
  let intent = await db.eventDeliveryIntent.findFirst({
    where: { id: data.intentId }
  });
  if (!intent) throw new QueueRetryError();

  await db.eventDeliveryIntent.updateMany({
    where: { id: data.intentId },
    data: {
      status: 'failed',
      errorCode: 'no_destination',
      errorMessage: 'No active destination instance found'
    }
  });

  await db.event.update({
    where: { oid: intent.eventOid },
    data: {
      deliveryFailureCount: { increment: 1 }
    }
  });

  await intentEndedQueue.add({ intentId: intent.id });
});

let intentEndedQueue = createQueue<{
  intentId: string;
}>({
  name: 'sgnl/event/intent_ended',
  redisUrl: env.service.REDIS_URL
});

export let intentEndedQueueProcessor = intentEndedQueue.process(async data => {
  let intent = await db.eventDeliveryIntent.findFirst({
    where: { id: data.intentId },
    include: { event: true }
  });
  if (!intent) throw new QueueRetryError();

  let event = intent.event;

  let totalSends = event.deliveryFailureCount + event.deliverySuccessCount;
  if (totalSends >= event.deliveryDestinationCount) {
    if (event.deliveryFailureCount > 0) {
      await eventFailedQueue.add({ eventId: event.id });
    } else {
      await eventSucceededQueue.add({ eventId: event.id });
    }
  }
});
