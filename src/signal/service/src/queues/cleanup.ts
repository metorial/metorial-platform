import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { subDays } from 'date-fns';
import { db } from '../db';
import { env } from '../env';
import { storageKey } from '../lib/storageKey';
import { storage } from '../storage';

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
  redisUrl: env.service.REDIS_URL
});

let cleanupSearchQueueProcessor = cleanupSearchQueue.process(async data => {
  let oldEvents = await db.event.findMany({
    where: {
      createdAt: { lt: data.time },
      id: data.cursor ? { lt: data.cursor } : undefined
    },
    orderBy: { id: 'desc' },
    take: 100
  });
  if (!oldEvents.length) return;

  await cleanupEventQueue.addMany(oldEvents.map(e => ({ eventId: e.id })));

  await cleanupSearchQueue.add({
    time: data.time,
    cursor: oldEvents[oldEvents.length - 1]!.id
  });
});

let cleanupEventQueue = createQueue<{ eventId: string }>({
  name: 'sgnl/cleanup/event',
  redisUrl: env.service.REDIS_URL
});

let cleanupEventQueueProcessor = cleanupEventQueue.process(async data => {
  let event = await db.event.findUnique({
    where: { id: data.eventId },
    include: { intents: { include: { attempts: true } } }
  });
  if (!event) return;

  await cleanupStorageKeyQueue.addMany([
    { storageKey: storageKey.event(event) },
    ...event.intents.flatMap(intent =>
      intent.attempts.map(attempt => ({
        storageKey: storageKey.attempt(attempt)
      }))
    )
  ]);
});

let cleanupStorageKeyQueue = createQueue<{ storageKey: string }>({
  name: 'sgnl/cleanup/storageKey',
  redisUrl: env.service.REDIS_URL
});

let cleanupStorageKeyQueueProcessor = cleanupStorageKeyQueue.process(async data => {
  await storage.deleteObject(env.storage.LOGS_BUCKET_NAME, data.storageKey);
});

export let cleanupQueues = combineQueueProcessors([
  cleanupProcessor,
  cleanupSearchQueueProcessor,
  cleanupEventQueueProcessor,
  cleanupStorageKeyQueueProcessor
]);
