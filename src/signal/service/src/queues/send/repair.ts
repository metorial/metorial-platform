import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
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
  let events = await store.event.findMany({
    where: {
      idempotencyKey: { not: null },
      initializationStatus: { not: 'initialized' },
      createdAt: { lte: before }
    },
    orderBy: { oid: 'asc' },
    take: d.batchSize ?? 250,
    select: { id: true }
  });
  for (let event of events) {
    await (d.enqueue ?? newEventQueue.add)({ eventId: event.id }, { id: event.id });
    await store.event.updateMany({
      where: { id: event.id, initializationStatus: { not: 'initialized' } },
      data: { initializationStatus: 'queued', initializationEnqueuedAt: new Date() }
    });
  }
  return { repaired: events.length, remaining: events.length === (d.batchSize ?? 250) };
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
