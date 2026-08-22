import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { eventFailedQueue, eventSucceededQueue } from './lifecycle';

let getIntentForTerminalTransition = (intentId: string) =>
  db.eventDeliveryIntent.findFirst({
    where: { id: intentId },
    include: {
      attempts: {
        orderBy: { attemptNumber: 'desc' as const },
        take: 1,
        select: { attemptNumber: true }
      }
    }
  });

let getTerminalAttemptCount = (
  queuedAttemptCount: number | undefined,
  intent: Awaited<ReturnType<typeof getIntentForTerminalTransition>>
) => queuedAttemptCount ?? intent?.attempts[0]?.attemptNumber ?? 0;

export let intentSucceededQueue = createQueue<{
  intentId: string;
  attemptCount?: number;
}>({
  name: 'sgnl/event/intent_succeeded',
  redisUrl: env.service.REDIS_URL
});

export let intentSucceededQueueProcessor = intentSucceededQueue.process(async data => {
  let intent = await getIntentForTerminalTransition(data.intentId);
  if (!intent) throw new QueueRetryError();
  let attemptCount = getTerminalAttemptCount(data.attemptCount, intent);

  await db.$transaction(async tx => {
    let transitioned = await tx.eventDeliveryIntent.updateMany({
      where: { id: data.intentId, status: { notIn: ['delivered', 'failed'] } },
      data: {
        status: 'delivered',
        attemptCount
      }
    });
    if (transitioned.count === 0) return;

    await tx.event.update({
      where: { oid: intent.eventOid },
      data: { deliverySuccessCount: { increment: 1 } }
    });
  });

  await intentEndedQueue.add({ intentId: intent.id }, { id: intent.id });
});

export let intentFailedQueue = createQueue<{
  intentId: string;
  errorCode: string;
  errorMessage: string;
  attemptCount?: number;
}>({
  name: 'sgnl/event/intent_failed',
  redisUrl: env.service.REDIS_URL
});

export let intentFailedQueueProcessor = intentFailedQueue.process(async data => {
  let intent = await getIntentForTerminalTransition(data.intentId);
  if (!intent) throw new QueueRetryError();
  let attemptCount = getTerminalAttemptCount(data.attemptCount, intent);

  await db.$transaction(async tx => {
    let transitioned = await tx.eventDeliveryIntent.updateMany({
      where: { id: data.intentId, status: { notIn: ['delivered', 'failed'] } },
      data: {
        status: 'failed',
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
        attemptCount
      }
    });
    if (transitioned.count === 0) return;

    await tx.event.update({
      where: { oid: intent.eventOid },
      data: { deliveryFailureCount: { increment: 1 } }
    });
  });

  await intentEndedQueue.add({ intentId: intent.id }, { id: intent.id });
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
      await eventFailedQueue.add({ eventId: event.id }, { id: event.id });
    } else {
      await eventSucceededQueue.add({ eventId: event.id }, { id: event.id });
    }
  }
});
