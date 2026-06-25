import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { eventCleanupQueue } from './cleanup';

export let eventFailedQueue = createQueue<{
  eventId: string;
}>({
  name: 'sgnl/event/failed',
  redisUrl: env.service.REDIS_URL
});

export let eventFailedQueueProcessor = eventFailedQueue.process(async data => {
  let event = await db.event.findFirst({
    where: { id: data.eventId }
  });
  if (!event) throw new QueueRetryError();

  await db.event.updateMany({
    where: { id: data.eventId },
    data: {
      status: 'failed'
    }
  });

  await eventCleanupQueue.add({ eventId: event.id });
});

export let eventSucceededQueue = createQueue<{
  eventId: string;
}>({
  name: 'sgnl/event/succeeded',
  redisUrl: env.service.REDIS_URL
});

export let eventSucceededQueueProcessor = eventSucceededQueue.process(async data => {
  let event = await db.event.findFirst({
    where: { id: data.eventId }
  });
  if (!event) throw new QueueRetryError();

  await db.event.updateMany({
    where: { id: data.eventId },
    data: {
      status: 'delivered'
    }
  });

  await eventCleanupQueue.add({ eventId: event.id });
});
