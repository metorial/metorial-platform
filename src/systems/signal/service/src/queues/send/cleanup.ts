import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { storageKey } from '../../lib/storageKey';
import { storage } from '../../storage';

export let eventCleanupQueue = createQueue<{
  eventId: string;
}>({
  name: 'sgnl/event/cleanup',
  redisUrl: env.service.REDIS_URL
});

export let eventCleanupQueueProcessor = eventCleanupQueue.process(async data => {
  let event = await db.event.findFirst({
    where: { id: data.eventId }
  });
  if (!event) throw new QueueRetryError();

  await db.eventDeliveryIntent.updateMany({
    where: { id: data.eventId, status: { notIn: ['delivered', 'failed'] } },
    data: { status: 'failed' }
  });

  await db.eventDeliveryAttempt.updateMany({
    where: {
      intent: {
        eventOid: event.oid
      },
      status: { not: 'succeeded' }
    },
    data: { status: 'failed' }
  });

  if (event.payloadJson) {
    await storage.putObject(
      env.storage.LOGS_BUCKET_NAME,
      storageKey.event(event),
      JSON.stringify({
        body: event.payloadJson,
        headers: event.headers
      })
    );

    await db.event.updateMany({
      where: { id: data.eventId },
      data: { payloadJson: null, headers: [] }
    });
  }
});
