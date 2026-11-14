import { createCron } from '@lowerdeck/cron';
import {
  combineQueueProcessors,
  createObjectDeleteQueue,
  createQueue,
  dailyPacedDelay
} from '@lowerdeck/queue';
import { subDays } from 'date-fns';
import { db } from '../db';
import { env } from '../env';
import { storageKey } from '../lib/storageKey';
import { storage } from '../storage';

let CLEANUP_BATCH_SIZE = 500;

let objectDelete = createObjectDeleteQueue({
  name: 'sgnl/storage/object/delete',
  redisUrl: env.service.REDIS_URL,
  deleteObject: (bucket, key) => storage.deleteObject(bucket, key)
});

let cleanupProcessor = createCron(
  {
    name: 'sgnl/cleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    let twoWeeksAgo = subDays(new Date(), 14);

    await cleanupSearchQueue.add({ time: twoWeeksAgo });
  }
);

let cleanupSearchQueue = createQueue<{ cursor?: string; time: Date }>({
  name: 'sgnl/cleanup/search',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

let cleanupSearchQueueProcessor = cleanupSearchQueue.process(async data => {
  let oldEvents = await db.event.findMany({
    where: {
      createdAt: { lt: data.time },
      id: data.cursor ? { lt: data.cursor } : undefined
    },
    orderBy: { id: 'desc' },
    take: CLEANUP_BATCH_SIZE,
    select: { id: true }
  });
  if (!oldEvents.length) return;

  await cleanupEventQueue.addMany(oldEvents.map(e => ({ eventId: e.id })));

  if (oldEvents.length === CLEANUP_BATCH_SIZE) {
    await cleanupSearchQueue.add(
      { time: data.time, cursor: oldEvents[oldEvents.length - 1]!.id },
      dailyPacedDelay()
    );
  }
});

let cleanupEventQueue = createQueue<{ eventId: string }>({
  name: 'sgnl/cleanup/event',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 5,
    limiter: { max: 20, duration: 1000 }
  }
});

let cleanupEventQueueProcessor = cleanupEventQueue.process(async data => {
  let event = await db.event.findUnique({
    where: { id: data.eventId },
    include: { intents: { include: { attempts: true } } }
  });
  if (!event) return;

  await objectDelete.enqueue(env.storage.LOGS_BUCKET_NAME, [
    storageKey.event(event),
    ...event.intents.flatMap(intent =>
      intent.attempts.map(attempt => storageKey.attempt(attempt))
    )
  ]);
});

export let cleanupQueues = combineQueueProcessors([
  cleanupProcessor,
  cleanupSearchQueueProcessor,
  cleanupEventQueueProcessor,
  objectDelete.processor
]);
