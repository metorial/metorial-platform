import { createCron } from '@metorial/cron';
import { db, Prisma } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { deliveryStorageKey } from '../lib/storageKey';
import { getDeliveryPayloadsBucketName, getStorage } from '../storage';

let batchSize = 100;
let flushAfterMs = 30 * 60_000;

export let eventDeliveryAttemptFlushManyQueue = createQueue<{
  dueBefore: string;
  cursor?: string;
}>({
  name: 'auditing/eventDelivery/attemptFlush/many',
  workerOpts: { concurrency: 1 }
});

export let eventDeliveryAttemptFlushSingleQueue = createQueue<{ attemptId: string }>({
  name: 'auditing/eventDelivery/attemptFlush/single',
  workerOpts: { concurrency: 5 }
});

export let eventDeliveryAttemptFlushManyProcessor = eventDeliveryAttemptFlushManyQueue.process(
  async data => {
    let attempts = await db.eventDeliveryAttempt.findMany({
      where: {
        detailsStorageKey: null,
        detailsJson: { not: Prisma.DbNull },
        createdAt: { lte: new Date(data.dueBefore) },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      select: { id: true },
      take: batchSize
    });
    if (attempts.length === 0) return;

    await eventDeliveryAttemptFlushSingleQueue.addManyWithOps(
      attempts.map(attempt => ({
        data: { attemptId: attempt.id },
        opts: { id: `event-delivery-attempt-flush:${attempt.id}` }
      }))
    );

    if (attempts.length === batchSize) {
      await eventDeliveryAttemptFlushManyQueue.add({
        dueBefore: data.dueBefore,
        cursor: attempts[attempts.length - 1]!.id
      });
    }
  }
);

export let eventDeliveryAttemptFlushSingleProcessor =
  eventDeliveryAttemptFlushSingleQueue.process(async data => {
    let attempt = await db.eventDeliveryAttempt.findUnique({
      where: { id: data.attemptId },
      select: { id: true, detailsJson: true, detailsStorageKey: true }
    });
    if (!attempt || !attempt.detailsJson || attempt.detailsStorageKey) return;

    let key = deliveryStorageKey.attemptDetails(attempt);

    await getStorage().putObject(
      getDeliveryPayloadsBucketName(),
      key,
      JSON.stringify(attempt.detailsJson),
      'application/json'
    );

    await db.eventDeliveryAttempt.update({
      where: { id: attempt.id },
      data: { detailsStorageKey: key, detailsJson: undefined }
    });
  });

export let eventDeliveryAttemptFlushCron = createCron(
  { name: 'auditing/eventDelivery/attemptFlush/cron', cron: '*/5 * * * *' },
  async () => {
    await eventDeliveryAttemptFlushManyQueue.add({
      dueBefore: new Date(Date.now() - flushAfterMs).toISOString()
    });
  }
);

export let eventDeliveryAttemptFlushProcessors = combineQueueProcessors([
  eventDeliveryAttemptFlushManyProcessor,
  eventDeliveryAttemptFlushSingleProcessor,
  eventDeliveryAttemptFlushCron
]);
