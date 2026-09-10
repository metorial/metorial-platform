import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { getEventPayloadsBucketName, getStorage } from '../storage';

let batchSize = 100;
let flushAfterMs = 30 * 60_000;

export let eventPayloadFlushManyQueue = createQueue<{
  dueBefore: string;
  cursor?: string;
}>({
  name: 'auditing/event/payloadFlush/many',
  workerOpts: { concurrency: 1 }
});

export let eventPayloadFlushSingleQueue = createQueue<{ eventId: string }>({
  name: 'auditing/event/payloadFlush/single',
  workerOpts: { concurrency: 5 }
});

export let flushEventPayload = async (d: { eventId: string }) => {
  let event = await db.systemEvent.findUnique({
    where: { id: d.eventId },
    select: { id: true, payloadJson: true, payloadStorageKey: true }
  });
  if (!event || !event.payloadJson || event.payloadStorageKey) return false;

  await getStorage().putObject(
    getEventPayloadsBucketName(),
    event.id,
    JSON.stringify(event.payloadJson),
    'application/json'
  );

  await db.systemEvent.update({
    where: { id: event.id },
    data: { payloadStorageKey: event.id, payloadJson: undefined }
  });

  return true;
};

export let eventPayloadFlushManyProcessor = eventPayloadFlushManyQueue.process(async data => {
  let events = await db.systemEvent.findMany({
    where: {
      payloadStorageKey: null,
      payloadJson: { not: undefined },
      createdAt: { lte: new Date(data.dueBefore) },
      id: data.cursor ? { gt: data.cursor } : undefined
    },
    orderBy: { id: 'asc' },
    select: { id: true },
    take: batchSize
  });
  if (events.length === 0) return;

  await eventPayloadFlushSingleQueue.addManyWithOps(
    events.map(event => ({
      data: { eventId: event.id },
      opts: { id: `event-payload-flush:${event.id}` }
    }))
  );

  if (events.length === batchSize) {
    await eventPayloadFlushManyQueue.add({
      dueBefore: data.dueBefore,
      cursor: events[events.length - 1]!.id
    });
  }
});

export let eventPayloadFlushSingleProcessor = eventPayloadFlushSingleQueue.process(
  async data => {
    await flushEventPayload({ eventId: data.eventId });
  }
);

export let eventPayloadFlushCron = createCron(
  { name: 'auditing/event/payloadFlush/cron', cron: '*/5 * * * *' },
  async () => {
    await eventPayloadFlushManyQueue.add({
      dueBefore: new Date(Date.now() - flushAfterMs).toISOString()
    });
  }
);

export let eventPayloadFlushProcessors = combineQueueProcessors([
  eventPayloadFlushManyProcessor,
  eventPayloadFlushSingleProcessor,
  eventPayloadFlushCron
]);
