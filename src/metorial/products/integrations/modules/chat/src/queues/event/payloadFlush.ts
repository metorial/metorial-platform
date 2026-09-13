import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { getChatEventPayloadsBucketName, storage } from '../../storage';

let batchSize = 100;
let flushAfterMs = 30 * 60_000;

export let chatEventPayloadFlushManyQueue = createQueue<{
  dueBefore: string;
  cursor?: string;
}>({
  name: 'sub/cht/evt/payloadFlush/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let chatEventPayloadFlushSingleQueue = createQueue<{ chatEventId: string }>({
  name: 'sub/cht/evt/payloadFlush/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5 }
});

export let flushChatEventPayload = async (d: { chatEventId: string }) => {
  let chatEvent = await db.chatEvent.findUnique({
    where: { id: d.chatEventId },
    select: { id: true, payload: true, payloadStorageKey: true }
  });
  if (!chatEvent?.payload || chatEvent.payloadStorageKey) return false;

  await storage.putObject(
    getChatEventPayloadsBucketName(),
    chatEvent.id,
    JSON.stringify(chatEvent.payload),
    'application/json'
  );

  await db.chatEvent.update({
    where: { id: chatEvent.id },
    data: { payloadStorageKey: chatEvent.id, payload: undefined }
  });

  return true;
};

export let chatEventPayloadFlushManyQueueProcessor = chatEventPayloadFlushManyQueue.process(
  async data => {
    let chatEvents = await db.chatEvent.findMany({
      where: {
        payloadStorageKey: null,
        payload: { not: undefined },
        createdAt: { lte: new Date(data.dueBefore) },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      select: { id: true },
      take: batchSize
    });
    if (chatEvents.length === 0) return;

    await chatEventPayloadFlushSingleQueue.addManyWithOps(
      chatEvents.map(chatEvent => ({
        data: { chatEventId: chatEvent.id },
        opts: { id: `chat-event-payload-flush:${chatEvent.id}` }
      }))
    );

    if (chatEvents.length === batchSize) {
      await chatEventPayloadFlushManyQueue.add({
        dueBefore: data.dueBefore,
        cursor: chatEvents[chatEvents.length - 1]!.id
      });
    }
  }
);

export let chatEventPayloadFlushSingleQueueProcessor =
  chatEventPayloadFlushSingleQueue.process(async data => {
    await flushChatEventPayload(data);
  });

export let chatEventPayloadFlushCron = createCron(
  {
    name: 'sub/cht/evt/payloadFlush/cron',
    cron: '*/5 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await chatEventPayloadFlushManyQueue.add({
      dueBefore: new Date(Date.now() - flushAfterMs).toISOString()
    });
  }
);
