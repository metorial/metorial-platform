import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { attemptDeliveryQueue } from './delivery';
import { enqueueDeliveryAttempt, type EnqueueDeliveryAttempt } from './deliveryRetry';
import { newEventQueue } from './init';

export let eventInitializationRepairQueue = createQueue<{ before?: string }>({
  name: 'sgnl/event/init/repair',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let repairEventInitialization = async (d: {
  store?: typeof db;
  before?: Date;
  batchSize?: number;
  enqueue?: typeof newEventQueue.add;
}) => {
  let store = d.store ?? db;
  let before = d.before ?? new Date();
  let batchSize = d.batchSize ?? 250;
  let events = await store.event.findMany({
    where: {
      initializationStatus: { not: 'initialized' },
      createdAt: { lte: before }
    },
    orderBy: { oid: 'asc' },
    take: batchSize,
    select: { id: true }
  });

  for (let event of events) {
    await (d.enqueue ?? newEventQueue.add)({ eventId: event.id }, { id: event.id });
    await store.event.updateMany({
      where: { id: event.id, initializationStatus: { not: 'initialized' } },
      data: { initializationStatus: 'queued' }
    });
  }

  return { repaired: events.length, remaining: events.length === batchSize };
};

export let eventInitializationRepairQueueProcessor = eventInitializationRepairQueue.process(
  async data => {
    let before = data.before ? new Date(data.before) : new Date();
    if (Number.isNaN(before.getTime())) throw new Error('Invalid repair cutoff');
    let result = await repairEventInitialization({ before });
    if (result.remaining) {
      await eventInitializationRepairQueue.add({ before: before.toISOString() });
    }
  }
);

export let eventInitializationRepairCron = createCron(
  {
    name: 'sgnl/event/init/repair/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    await eventInitializationRepairQueue.add(
      { before: new Date().toISOString() },
      { id: 'periodic' }
    );
  }
);

export let eventDeliveryRetryRepairQueue = createQueue<{ before?: string }>({
  name: 'sgnl/event/delivery/retry/repair',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let repairEventDeliveryRetries = async (d: {
  store?: typeof db;
  before?: Date;
  batchSize?: number;
  enqueue?: EnqueueDeliveryAttempt;
}) => {
  let store = d.store ?? db;
  let before = d.before ?? new Date();
  let batchSize = d.batchSize ?? 250;
  let intents = await store.eventDeliveryIntent.findMany({
    where: {
      status: { in: ['pending', 'retrying'] },
      nextAttemptAt: { lte: before }
    },
    orderBy: { oid: 'asc' },
    take: batchSize,
    select: {
      id: true,
      attemptCount: true,
      attempts: {
        orderBy: { attemptNumber: 'desc' },
        take: 1,
        select: { attemptNumber: true }
      }
    }
  });

  let repaired = 0;
  for (let intent of intents) {
    let latestAttempt = intent.attempts[0];
    let attemptNumber =
      latestAttempt && latestAttempt.attemptNumber > intent.attemptCount
        ? latestAttempt.attemptNumber
        : intent.attemptCount + 1;

    await enqueueDeliveryAttempt({
      enqueue: d.enqueue ?? attemptDeliveryQueue.add,
      intentId: intent.id,
      attemptNumber
    });
    repaired++;
  }

  return { repaired, remaining: intents.length === batchSize };
};

export let eventDeliveryRetryRepairQueueProcessor = eventDeliveryRetryRepairQueue.process(
  async data => {
    let before = data.before ? new Date(data.before) : new Date();
    if (Number.isNaN(before.getTime())) throw new Error('Invalid repair cutoff');
    let result = await repairEventDeliveryRetries({ before });
    if (result.remaining) {
      await eventDeliveryRetryRepairQueue.add({ before: before.toISOString() });
    }
  }
);

export let eventDeliveryRetryRepairCron = createCron(
  {
    name: 'sgnl/event/delivery/retry/repair/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    let before = new Date(Date.now() - 60_000);
    await eventDeliveryRetryRepairQueue.add(
      { before: before.toISOString() },
      { id: 'periodic' }
    );
  }
);
